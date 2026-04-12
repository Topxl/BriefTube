import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { env } from "@/lib/env";
import { getUser } from "@/lib/auth/auth-user";
import { workerFetch, workerPost } from "@/lib/worker-fetch";

const execAsync = promisify(exec);

async function requireAdminOrNull() {
  const user = await getUser();
  if (!env.ADMIN_USER_ID || user?.id !== env.ADMIN_USER_ID) return null;
  return user;
}

export async function GET() {
  const user = await requireAdminOrNull();
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!env.WORKER_API_SECRET) {
    return NextResponse.json(
      { error: "WORKER_API_SECRET is required" },
      { status: 500 },
    );
  }

  // Dev mode: SSH to VPS (uses local SSH key)
  if (process.env.NODE_ENV === "development") {
    try {
      const cmd = `ssh -o ConnectTimeout=5 brieftube-vps "curl -s -H 'Authorization: Bearer ${env.WORKER_API_SECRET}' http://localhost:8080/web-logs"`;
      const { stdout } = await execAsync(cmd, { timeout: 15_000 });
      return NextResponse.json(JSON.parse(stdout));
    } catch (e) {
      return NextResponse.json(
        { error: `Cannot reach VPS via SSH: ${String(e)}` },
        { status: 502 },
      );
    }
  }

  if (!env.VPS_WORKER_URL) {
    return NextResponse.json(
      { error: "Worker not configured (VPS_WORKER_URL missing)" },
      { status: 503 },
    );
  }

  try {
    const raw = await workerFetch("/web-logs");
    return NextResponse.json(JSON.parse(raw));
  } catch (e) {
    return NextResponse.json(
      { error: `Cannot reach worker: ${String(e)}` },
      { status: 502 },
    );
  }
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

  if (!env.VPS_WORKER_URL || !env.WORKER_API_SECRET) {
    return NextResponse.json(
      { error: "Worker not configured" },
      { status: 503 },
    );
  }

  try {
    const raw = await workerPost("/web-action", { action });
    return NextResponse.json(JSON.parse(raw));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
