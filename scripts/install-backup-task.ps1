# Registers (or updates) the Windows scheduled task that runs scripts\backup.ps1 every day.
# Usage: powershell -ExecutionPolicy Bypass -File scripts\install-backup-task.ps1 [-At "2:00AM"]
param(
  [string]$At = "2:00AM",
  [string]$TaskName = "Fuel Monitoring Daily Backup"
)

$ErrorActionPreference = "Stop"
$script = Join-Path $PSScriptRoot "backup.ps1"
$root = Split-Path -Parent $PSScriptRoot

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`"" `
  -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -Daily -At $At
# StartWhenAvailable catches up on a missed run if the PC was off at the scheduled time.
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Hours 1) -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal `
  -Description "Backs up the fuel-monitoring app files and database into $root\backups" -Force | Out-Null

$info = Get-ScheduledTask -TaskName $TaskName | Get-ScheduledTaskInfo
Write-Output "Registered '$TaskName' - daily at $At. Next run: $($info.NextRunTime)"
