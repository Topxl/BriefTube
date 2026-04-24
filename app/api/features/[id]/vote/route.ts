import { authRoute } from "@/lib/zod-route";
import { createClient } from "@/lib/supabase/server";
import { authRateLimit, checkRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

type Params = { id: string };

/**
 * POST /api/features/[id]/vote
 * Toggle the current user's vote for a feature request.
 * Returns the new vote state and the new votes_count.
 */
export const POST = authRoute.handler(async (_req, { ctx, params }) => {
  const featureId = (params as unknown as Params).id;

  const rl = await checkRateLimit(authRateLimit, `vote:${ctx.user.id}`);
  if (rl) return rl;

  const supabase = await createClient();

  // Verify the feature exists
  const { data: feature } = await supabase
    .from("feature_requests")
    .select("id, status, needs_admin_review, user_id")
    .eq("id", featureId)
    .maybeSingle();

  if (!feature) {
    return NextResponse.json({ error: "Feature not found" }, { status: 404 });
  }

  // Block votes on pending features unless the caller is the proposer
  if (feature.needs_admin_review && feature.user_id !== ctx.user.id) {
    return NextResponse.json({ error: "Feature not found" }, { status: 404 });
  }

  // Toggle: check if a vote already exists
  const { data: existingVote } = await supabase
    .from("feature_votes")
    .select("id")
    .eq("feature_request_id", featureId)
    .eq("user_id", ctx.user.id)
    .maybeSingle();

  let voted: boolean;
  if (existingVote) {
    await supabase.from("feature_votes").delete().eq("id", existingVote.id);
    voted = false;
  } else {
    await supabase.from("feature_votes").insert({
      feature_request_id: featureId,
      user_id: ctx.user.id,
    });
    voted = true;
  }

  // Re-read the votes_count (kept in sync by trigger)
  const { data: updated } = await supabase
    .from("feature_requests")
    .select("votes_count")
    .eq("id", featureId)
    .maybeSingle();

  return {
    ok: true,
    voted,
    votes_count: updated?.votes_count ?? 0,
  };
});
