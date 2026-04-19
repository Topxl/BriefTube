import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, authRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type Params = { params: Promise<{ id: string }> };

// POST /api/deliveries/[id]/listened — mark a delivery as engaged (first engagement wins, idempotent)
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = await checkRateLimit(authRateLimit, user.id);
  if (rateLimitResponse) return rateLimitResponse;

  const { error } = await supabase
    .from("deliveries")
    .update({ listened_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("listened_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
