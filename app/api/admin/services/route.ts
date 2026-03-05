import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";

const ADMIN_USER_ID = "67320a39-948c-44d2-98e3-c0de49af1ec6";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.id !== ADMIN_USER_ID) return null;
  return user;
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!env.VPS_WORKER_URL) {
    return NextResponse.json({ error: "Worker not configured" }, { status: 503 });
  }

  const url = `${env.VPS_WORKER_URL}/services${env.WORKER_API_SECRET ? `?token=${env.WORKER_API_SECRET}` : ""}`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Worker returned ${res.status}`);
    return NextResponse.json(await res.json());
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
