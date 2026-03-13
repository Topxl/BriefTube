import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!env.ADMIN_USER_ID || user?.id !== env.ADMIN_USER_ID) return null;
  return user;
}

export async function GET() {
  const user = await requireAdmin();
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
