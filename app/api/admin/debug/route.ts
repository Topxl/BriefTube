import { NextResponse } from "next/server";
import { execFileSync, execSync } from "child_process";
import { env } from "@/lib/env";
import { getUser } from "@/lib/auth/auth-user";

export async function GET() {
  const debug: Record<string, unknown> = {};

  // 1. Auth check
  try {
    const user = await getUser();
    debug.userId = user?.id ?? null;
    debug.isAdmin = !!env.ADMIN_USER_ID && user?.id === env.ADMIN_USER_ID;
  } catch (e) {
    debug.authError = String(e);
  }

  // 2. Env check
  debug.vpsWorkerUrl = env.VPS_WORKER_URL ?? "NOT SET";
  debug.workerApiSecret = env.WORKER_API_SECRET ? "SET" : "NOT SET";

  if (!debug.isAdmin) return NextResponse.json(debug);

  const secret = env.WORKER_API_SECRET;
  const baseUrl = env.VPS_WORKER_URL;

  // 3. Test execFileSync (no -f flag so we see the response)
  try {
    const result = execFileSync(
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
    debug.test1_execFileSync = result.trim();
  } catch (e: unknown) {
    const err = e as { status?: number; stderr?: string; stdout?: string };
    debug.test1_error = {
      status: err.status,
      stderr: err.stderr?.slice(0, 200),
      stdout: err.stdout?.slice(0, 200),
    };
  }

  // 4. Test execSync (shell-based)
  try {
    const cmd = `/usr/bin/curl -s --max-time 5 -w '\\n%{http_code}' -H "Authorization: Bearer ${secret}" "${baseUrl}/health"`;
    const result = execSync(cmd, { timeout: 8000, encoding: "utf-8" });
    debug.test2_execSync = result.trim();
  } catch (e: unknown) {
    const err = e as { status?: number; stderr?: string; stdout?: string };
    debug.test2_error = {
      status: err.status,
      stderr: err.stderr?.slice(0, 200),
      stdout: err.stdout?.slice(0, 200),
    };
  }

  return NextResponse.json(debug);
}
