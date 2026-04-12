import { NextResponse } from "next/server";
import { execFileSync } from "child_process";
import { env } from "@/lib/env";
import { getUser } from "@/lib/auth/auth-user";

export async function GET() {
  const debug: Record<string, unknown> = {};

  // 1. Auth check
  try {
    const user = await getUser();
    debug.userId = user?.id ?? null;
    debug.isAdmin = !!env.ADMIN_USER_ID && user?.id === env.ADMIN_USER_ID;
    debug.adminUserId = env.ADMIN_USER_ID
      ? `${env.ADMIN_USER_ID.slice(0, 8)}...`
      : "NOT SET";
  } catch (e) {
    debug.authError = String(e);
  }

  // 2. Env check
  debug.vpsWorkerUrl = env.VPS_WORKER_URL ?? "NOT SET";
  debug.workerApiSecret = env.WORKER_API_SECRET ? "SET" : "NOT SET";
  debug.nodeEnv = process.env.NODE_ENV;
  debug.skipEnvValidation = process.env.SKIP_ENV_VALIDATION;

  // 3. Curl test (only if admin)
  if (debug.isAdmin && env.VPS_WORKER_URL && env.WORKER_API_SECRET) {
    try {
      const result = execFileSync(
        "curl",
        [
          "-sf",
          "--max-time",
          "5",
          "-H",
          `Authorization: Bearer ${env.WORKER_API_SECRET}`,
          `${env.VPS_WORKER_URL}/health`,
        ],
        { timeout: 8000, encoding: "utf-8" },
      );
      debug.curlResult = JSON.parse(result);
    } catch (e) {
      debug.curlError = String(e).slice(0, 300);
    }
  }

  return NextResponse.json(debug);
}
