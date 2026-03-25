import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { readFile } from "fs/promises";
import path from "path";
import { env } from "@/lib/env";
import { getUser } from "@/lib/auth/auth-user";

const execAsync = promisify(exec);
const LOG_PATH = path.join(process.cwd(), "worker", "worker.log");

async function requireAdminOrNull() {
  const user = await getUser();
  if (!env.ADMIN_USER_ID || user?.id !== env.ADMIN_USER_ID) return null;
  return user;
}

function deduplicateLines(lines: string[]): string[] {
  return lines.filter((line, i) => i === 0 || line !== lines[i - 1]);
}

export async function GET() {
  const user = await requireAdminOrNull();
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // --- VPS remote endpoint (preferred) ---
  if (env.VPS_WORKER_URL) {
    const url = `${env.VPS_WORKER_URL}/logs`;
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
        headers: env.WORKER_API_SECRET
          ? { Authorization: `Bearer ${env.WORKER_API_SECRET}` }
          : {},
      });
      if (!res.ok) throw new Error(`VPS returned ${res.status}`);
      const data = await res.json();
      return NextResponse.json(data);
    } catch (e) {
      return NextResponse.json(
        { error: `Cannot reach VPS worker: ${String(e)}` },
        { status: 502 },
      );
    }
  }

  // --- Fallback: local filesystem + systemctl (dev / single-machine deploy) ---

  type WorkerStatus = {
    active: boolean;
    status: string;
    pid: string | null;
    memory: string | null;
    cpu: string | null;
    since: string | null;
  };

  const workerStatus: WorkerStatus = {
    active: false,
    status: "unknown",
    pid: null,
    memory: null,
    cpu: null,
    since: null,
  };

  try {
    // systemctl exits with code 3 when inactive — catch and still parse stdout
    const result = await execAsync(
      "systemctl status brieftube-worker --no-pager 2>&1",
    ).catch((e: { stdout?: string }) => ({ stdout: e.stdout ?? "" }));

    const stdout = (result as { stdout: string }).stdout;
    const activeMatch = stdout.match(/Active: (.+)/);
    const pidMatch = stdout.match(/Main PID: (\d+)/);
    const memMatch = stdout.match(/Memory: ([^\n(]+)/);
    const cpuMatch = stdout.match(/CPU: ([^\n]+)/);
    const sinceMatch = stdout.match(/since [A-Za-z]+ (.+?);/);

    const activeStr = activeMatch?.[1] ?? "";
    workerStatus.active = activeStr.includes("active (running)");
    workerStatus.status = activeStr.trim().split(";")[0]?.trim() ?? "unknown";
    workerStatus.pid = pidMatch?.[1] ?? null;
    workerStatus.memory = memMatch?.[1]?.trim() ?? null;
    workerStatus.cpu = cpuMatch?.[1]?.trim() ?? null;
    workerStatus.since = sinceMatch?.[1]?.trim() ?? null;
  } catch {
    workerStatus.status = "error reading status";
  }

  // --- Log file ---
  let logLines: string[] = [];
  let recentErrors: string[] = [];
  let errorCount = 0;

  try {
    const content = await readFile(LOG_PATH, "utf-8");
    const allLines = content.split("\n").filter(Boolean);
    const deduped = deduplicateLines(allLines);

    logLines = deduped.slice(-60);

    const last200 = deduped.slice(-200);
    errorCount = last200.filter(
      (l) => l.includes("] ERROR") || l.includes("] CRITICAL"),
    ).length;

    recentErrors = last200
      .filter(
        (l) =>
          l.includes("] ERROR") ||
          l.includes("] CRITICAL") ||
          l.includes("] WARNING"),
      )
      .slice(-10);
  } catch {
    logLines = ["Log file not accessible"];
  }

  return NextResponse.json({
    workerStatus,
    logLines,
    recentErrors,
    errorCount,
    timestamp: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  const user = await requireAdminOrNull();
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as { action?: string };
  const action = body.action;

  if (!["start", "stop", "restart"].includes(action ?? "")) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  try {
    await execAsync(`sudo systemctl ${action} brieftube-worker`);
    return NextResponse.json({ success: true, action });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
