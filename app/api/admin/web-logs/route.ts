import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { getUser } from "@/lib/auth/auth-user";

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

  if (!env.VPS_WORKER_URL || !env.WORKER_API_SECRET) {
    return NextResponse.json(
      {
        error:
          "Worker not configured (VPS_WORKER_URL or WORKER_API_SECRET missing)",
      },
      { status: 503 },
    );
  }

  const url = `${env.VPS_WORKER_URL}/web-logs`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
      headers: { Authorization: `Bearer ${env.WORKER_API_SECRET}` },
    });
    if (!res.ok) throw new Error(`Worker returned ${res.status}`);
    return NextResponse.json(await res.json());
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

  const url = `${env.VPS_WORKER_URL}/web-action`;
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${env.WORKER_API_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) throw new Error(`Worker returned ${res.status}`);
    return NextResponse.json(await res.json());
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
