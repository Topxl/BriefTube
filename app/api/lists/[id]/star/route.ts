import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, authRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type Params = { params: Promise<{ id: string }> };

// POST /api/lists/[id]/star — auth required, toggle star
export async function POST(req: NextRequest, { params }: Params) {
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

  // Check if already starred
  const { data: existing } = await supabase
    .from("list_stars")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("list_id", id)
    .maybeSingle();

  if (existing) {
    // Unstar
    await supabase
      .from("list_stars")
      .delete()
      .eq("user_id", user.id)
      .eq("list_id", id);
    return NextResponse.json({ starred: false });
  }

  // Star
  const { error } = await supabase
    .from("list_stars")
    .insert({ user_id: user.id, list_id: id });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ starred: true });
}
