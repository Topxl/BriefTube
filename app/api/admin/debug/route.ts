import { NextResponse } from "next/server";
import { spawnSync } from "child_process";
import { env } from "@/lib/env";
import { getUser } from "@/lib/auth/auth-user";

export async function GET() {
  const debug: Record<string, unknown> = {};

  try {
    const user = await getUser();
    debug.userId = user?.id ?? null;
    debug.isAdmin = !!env.ADMIN_USER_ID && user?.id === env.ADMIN_USER_ID;
  } catch (e) {
    debug.authError = String(e);
  }

  if (!debug.isAdmin) return NextResponse.json(debug);

  const secret = env.WORKER_API_SECRET;
  const baseUrl = env.VPS_WORKER_URL;

  // Test spawnSync
  const proc = spawnSync(
    "/usr/bin/curl",
    [
      "-s",
      "--max-time",
      "5",
      "-w",
      "\\n%{http_code}",
      "-H",
      `Authorization: Bearer ${secret}`,
      `${baseUrl}/health`,
    ],
    { timeout: 8000, encoding: "utf-8" },
  );

  debug.spawnSync = {
    status: proc.status,
    signal: proc.signal,
    stdout: proc.stdout.slice(0, 300),
    stderr: proc.stderr.slice(0, 200),
    error: proc.error ? String(proc.error) : null,
    pid: proc.pid,
  };

  return NextResponse.json(debug);
}
