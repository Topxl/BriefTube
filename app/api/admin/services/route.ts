import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getUser } from "@/lib/auth/auth-user";

async function requireAdminOrNull() {
  const user = await getUser();
  if (!env.ADMIN_USER_ID || user?.id !== env.ADMIN_USER_ID) return null;
  return user;
}

export async function GET() {
  const user = await requireAdminOrNull();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!env.VPS_WORKER_URL) {
    return NextResponse.json(
      { error: "Worker not configured" },
      { status: 503 },
    );
  }

  const url = `${env.VPS_WORKER_URL}/services`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
      headers: env.WORKER_API_SECRET
        ? { Authorization: `Bearer ${env.WORKER_API_SECRET}` }
        : {},
    });
    if (!res.ok) throw new Error(`Worker returned ${res.status}`);
    return NextResponse.json(await res.json());
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
