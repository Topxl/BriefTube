import { execFile } from "child_process";
import { promisify } from "util";
import os from "os";
import path from "path";
import { env } from "@/lib/env";

const execFileAsync = promisify(execFile);

// SSH ControlMaster multiplexes all dev-mode worker calls through a single
// TCP connection, turning the 2nd+ handshake into ~50ms instead of ~2.8s.
// Without this, three parallel admin routes (/worker, /web-logs, /services)
// all open their own SSH session and the cumulative latency trips timeouts.
const CONTROL_DIR = path.join(os.homedir(), ".ssh", "cm");
const SSH_OPTS = [
  "-o",
  "ConnectTimeout=5",
  "-o",
  "ControlMaster=auto",
  "-o",
  `ControlPath=${CONTROL_DIR}/%r@%h:%p`,
  "-o",
  "ControlPersist=60s",
];

/**
 * Call a worker HTTP endpoint through an SSH tunnel in dev mode.
 * Reuses a multiplexed SSH connection across concurrent admin routes.
 */
export async function sshWorkerCall(
  endpoint: string,
  timeoutMs = 15_000,
): Promise<string> {
  if (!env.WORKER_API_SECRET) {
    throw new Error("WORKER_API_SECRET not set");
  }
  const remoteCmd = `curl -s --max-time 10 -H 'Authorization: Bearer ${env.WORKER_API_SECRET}' http://localhost:8080${endpoint}`;
  const { stdout } = await execFileAsync(
    "ssh",
    [...SSH_OPTS, "brieftube-vps", remoteCmd],
    { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 },
  );
  return stdout;
}
