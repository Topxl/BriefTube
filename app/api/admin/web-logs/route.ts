import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { env } from "@/lib/env";
import { getUser } from "@/lib/auth/auth-user";

const execAsync = promisify(exec);

// In dev, prefix commands with `ssh brieftube-vps` so they run on the VPS
// where the actual web service is. In prod, run locally on the VPS.
const isDev = process.env.NODE_ENV === "development";
function vpsCmd(cmd: string): string {
  if (isDev) {
    return `ssh -o ConnectTimeout=5 brieftube-vps ${JSON.stringify(cmd)}`;
  }
  // In production: use absolute paths so the Next.js child process can find them
  return cmd
    .replace(/\bjournalctl\b/g, "/usr/bin/journalctl")
    .replace(/\bsystemctl\b/g, "/usr/bin/systemctl");
}

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

  type WebStatus = {
    active: boolean;
    status: string;
    pid: string | null;
    memory: string | null;
    since: string | null;
  };

  const webStatus: WebStatus = {
    active: false,
    status: "unknown",
    pid: null,
    memory: null,
    since: null,
  };

  try {
    const result = await execAsync(
      vpsCmd("systemctl status brieftube-web --no-pager 2>&1"),
    ).catch((e: { stdout?: string }) => ({ stdout: e.stdout ?? "" }));

    const stdout = (result as { stdout: string }).stdout;
    const activeMatch = stdout.match(/Active: (.+)/);
    const pidMatch = stdout.match(/Main PID: (\d+)/);
    const memMatch = stdout.match(/Memory: ([^\n(]+)/);
    const sinceMatch = stdout.match(/since [A-Za-z]+ (.+?);/);

    const activeStr = activeMatch?.[1] ?? "";
    webStatus.active = activeStr.includes("active (running)");
    webStatus.status = activeStr.trim().split(";")[0]?.trim() ?? "unknown";
    webStatus.pid = pidMatch?.[1] ?? null;
    webStatus.memory = memMatch?.[1]?.trim() ?? null;
    webStatus.since = sinceMatch?.[1]?.trim() ?? null;
  } catch {
    webStatus.status = "error reading status";
  }

  let logLines: string[] = [];
  let recentErrors: string[] = [];
  let errorCount = 0;

  try {
    const { stdout: logOut } = await execAsync(
      vpsCmd(
        "journalctl -u brieftube-web -n 200 --no-pager -o cat 2>&1 || echo 'No logs available'",
      ),
    );

    const allLines = logOut.split("\n").filter(Boolean);
    const deduped = deduplicateLines(allLines);

    logLines = deduped.slice(-60);

    const last200 = deduped.slice(-200);
    errorCount = last200.filter(
      (l) => l.includes("ERROR") || l.includes("error"),
    ).length;

    recentErrors = last200
      .filter(
        (l) =>
          l.includes("ERROR") ||
          l.includes("error") ||
          l.includes("failed") ||
          l.includes("Failed"),
      )
      .slice(-10);
  } catch {
    logLines = ["Log retrieval unavailable"];
  }

  return NextResponse.json({
    webStatus,
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
    await execAsync(vpsCmd(`sudo systemctl ${action} brieftube-web`));
    return NextResponse.json({ success: true, action });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
