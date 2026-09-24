# Daily backup of the app files and the database into one timestamped folder per run:
#   backups\<yyyy-MM-dd_HHmmss>\fuel-monitoring-app_<yyyy-MM-dd_HHmmss>.zip
#   backups\<yyyy-MM-dd_HHmmss>\fuel_monitoring-db_<yyyy-MM-dd_HHmmss>.sql
# Run by the "Fuel Monitoring Daily Backup" scheduled task (see install-backup-task.ps1),
# or manually with: npm run backup
param(
  [int]$RetentionDays = 30
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$backupRoot = Join-Path $root "backups"
$stamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$runDir = Join-Path $backupRoot $stamp
$logFile = Join-Path $backupRoot "backup.log"
New-Item -ItemType Directory -Force $runDir | Out-Null

function Write-Log([string]$message) {
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $message
  Write-Output $line
  Add-Content -Path $logFile -Value $line -Encoding utf8
}

function Get-EnvValue([string]$name) {
  $line = Get-Content (Join-Path $root ".env") | Where-Object { $_ -match "^\s*$name\s*=" } | Select-Object -First 1
  if (-not $line) { throw "$name is not set in .env" }
  return ($line -replace "^\s*$name\s*=\s*", "").Trim().Trim('"').Trim("'")
}

function Find-MysqlDump {
  # XAMPP's MariaDB client matches the server this app runs on; fall back to anything on PATH.
  foreach ($candidate in "C:\xampp\mysql\bin\mysqldump.exe", "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqldump.exe") {
    if (Test-Path $candidate) { return $candidate }
  }
  $onPath = Get-Command mysqldump -ErrorAction SilentlyContinue
  if ($onPath) { return $onPath.Source }
  throw "mysqldump was not found"
}

function Backup-Database {
  $url = [uri](Get-EnvValue "DATABASE_URL")
  $user, $password = $url.UserInfo.Split(":", 2)
  $database = $url.AbsolutePath.TrimStart("/")
  $port = if ($url.Port -gt 0) { $url.Port } else { 3306 }
  $file = Join-Path $runDir "$database-db_$stamp.sql"

  # Password goes through the environment so it never appears in the process list.
  $env:MYSQL_PWD = if ($password) { [uri]::UnescapeDataString($password) } else { "" }
  try {
    # --result-file avoids PowerShell re-encoding the dump the way ">" redirection would.
    & (Find-MysqlDump) --host=$($url.Host) --port=$port --user=$([uri]::UnescapeDataString($user)) `
      --single-transaction --quick --routines --triggers --default-character-set=utf8mb4 `
      --result-file=$file $database
    if ($LASTEXITCODE -ne 0) { throw "mysqldump exited with code $LASTEXITCODE" }
  } finally {
    Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
  }
  Write-Log ("Database backup: {0} ({1:N0} KB)" -f $file, ((Get-Item $file).Length / 1KB))
}

function Backup-App {
  $file = Join-Path $runDir "fuel-monitoring-app_$stamp.zip"
  # Dependencies and build output are rebuilt with npm install / npm run build, so they are left out.
  $skip = @("node_modules", ".next", "backups", "tmp")
  $entries = Get-ChildItem -Path $root -Force | Where-Object { $skip -notcontains $_.Name } | ForEach-Object { $_.Name }

  & "$env:SystemRoot\System32\tar.exe" -a -c -f $file --exclude=node_modules -C $root @entries
  if ($LASTEXITCODE -ne 0) {
    if (-not (Test-Path $file)) { throw "tar exited with code $LASTEXITCODE" }
    Write-Log "Warning: tar exited with code $LASTEXITCODE (some files may have been in use)"
  }
  Write-Log ("App backup: {0} ({1:N0} KB)" -f $file, ((Get-Item $file).Length / 1KB))
}

function Remove-OldBackups {
  $cutoff = (Get-Date).AddDays(-$RetentionDays)
  Get-ChildItem $backupRoot -Directory |
    Where-Object { $_.Name -match "^\d{4}-\d{2}-\d{2}_\d{6}$" -and $_.CreationTime -lt $cutoff } |
    ForEach-Object { Remove-Item $_.FullName -Recurse -Force; Write-Log "Removed old backup: $($_.FullName)" }
}

Write-Log "Backup $stamp started"
$failed = $false
foreach ($step in "Backup-Database", "Backup-App") {
  try { & $step } catch { $failed = $true; Write-Log "ERROR in ${step}: $($_.Exception.Message)" }
}
if (-not $failed) { Remove-OldBackups }
Write-Log ("Backup $stamp " + $(if ($failed) { "finished with errors" } else { "finished" }))
if ($failed) { exit 1 }
