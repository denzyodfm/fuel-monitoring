// Frees the app port before `next dev` / `next start` so a stale server
// can't push the app onto a different port or make it fail to bind.
import { execSync } from "node:child_process";

const port = Number(process.argv[2] ?? 3010);

function pidsOnPort() {
  try {
    if (process.platform === "win32") {
      const out = execSync(`netstat -ano -p tcp | findstr LISTENING | findstr :${port}`, { encoding: "utf8" });
      return [
        ...new Set(
          out
            .split(/\r?\n/)
            .map((line) => line.trim().split(/\s+/))
            .filter((cols) => cols[1]?.endsWith(`:${port}`))
            .map((cols) => cols[4]),
        ),
      ];
    }
    return execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: "utf8" }).split("\n").filter(Boolean);
  } catch {
    return []; // no matches
  }
}

for (const pid of pidsOnPort()) {
  if (Number(pid) === process.pid || pid === "0") continue;
  try {
    if (process.platform === "win32") execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
    else process.kill(Number(pid), "SIGKILL");
    console.log(`Freed port ${port} (stopped PID ${pid})`);
  } catch {
    console.warn(`Could not stop PID ${pid} on port ${port}`);
  }
}
