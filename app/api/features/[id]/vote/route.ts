import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { authRateLimit, checkRateLimit } from "@/lib/rate-limit";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/features/[id]/vote
 * Toggle the current user's vote for a feature request.
 * Returns the new vote state and the new votes_count.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(authRateLimit, `vote:${user.id}`);
  if (rl) return rl;

  const { id: featureId } = await params;
  const admin = createAdminClient();

  // Verify the feature exists
  const { data: feature } = await admin
    .from("feature_requests")
    .select("id, status, needs_admin_review, user_id")
    .eq("id", featureId)
    .maybeSingle();

  if (!feature) {
    return NextResponse.json({ error: "Feature not found" }, { status: 404 });
  }

  // Block votes on pending features unless the caller is the proposer
  if (feature.needs_admin_review && feature.user_id !== user.id) {
    return NextResponse.json({ error: "Feature not found" }, { status: 404 });
  }

  // Toggle: check if a vote already exists
  const { data: existingVote } = await admin
    .from("feature_votes")
    .select("id")
    .eq("feature_request_id", featureId)
    .eq("user_id", user.id)
    .maybeSingle();

  let voted: boolean;
  if (existingVote) {
    await admin.from("feature_votes").delete().eq("id", existingVote.id);
    voted = false;
  } else {
    await admin.from("feature_votes").insert({
      feature_request_id: featureId,
      user_id: user.id,
    });
    voted = true;
  }

  // Re-read the votes_count (kept in sync by trigger)
  const { data: updated } = await admin
    .from("feature_requests")
    .select("votes_count")
    .eq("id", featureId)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    voted,
    votes_count: updated?.votes_count ?? 0,
  });
}
