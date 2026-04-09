import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  authRateLimit,
  checkRateLimit,
  getRequestIp,
  publicRateLimit,
} from "@/lib/rate-limit";

const FEATURE_CATEGORIES = [
  "feature",
  "improvement",
  "integration",
  "ui_ux",
  "other",
] as const;

const createSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(2000),
  category: z.enum(FEATURE_CATEGORIES).default("feature"),
});

/**
 * GET /api/features
 * Public list of feature requests with the user's votes (when logged in).
 * Query params:
 *   - status: filter by status (or "all")
 *   - sort: "votes" | "recent"   (default: votes)
 *   - limit: number (default 100)
 */
export async function GET(req: NextRequest) {
  const ip = getRequestIp(req);
  const rl = await checkRateLimit(publicRateLimit, `features:${ip}`);
  if (rl) return rl;

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status") ?? "all";
  const sort = url.searchParams.get("sort") ?? "votes";
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") ?? "100", 10), 1),
    300,
  );

  const admin = createAdminClient();

  // Fetch the current user once so we can include their own pending features
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = admin
    .from("feature_requests")
    .select(
      "id, user_id, title, description, status, category, priority, votes_count, source, needs_admin_review, created_at, updated_at",
    )
    .neq("status", "rejected")
    .limit(limit);

  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  // Public features (approved) + user's own pending features.
  // Anonymous visitors only see approved.
  if (user) {
    query = query.or(`needs_admin_review.eq.false,user_id.eq.${user.id}`);
  } else {
    query = query.eq("needs_admin_review", false);
  }

  if (sort === "recent") {
    query = query.order("created_at", { ascending: false });
  } else {
    query = query
      .order("votes_count", { ascending: false })
      .order("created_at", { ascending: false });
  }

  const { data: features, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let userVotes: string[] = [];
  if (user && features.length > 0) {
    const { data: voteRows } = await admin
      .from("feature_votes")
      .select("feature_request_id")
      .eq("user_id", user.id)
      .in(
        "feature_request_id",
        features.map((f) => f.id),
      );
    userVotes = (voteRows ?? []).map((v) => v.feature_request_id);
  }

  return NextResponse.json({
    features,
    user_votes: userVotes,
    current_user_id: user?.id ?? null,
  });
}

/**
 * POST /api/features
 * Create a new feature request (auth required).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(authRateLimit, `features:create:${user.id}`);
  if (rl) return rl;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid body" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: feature, error } = await admin
    .from("feature_requests")
    .insert({
      user_id: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      status: "new",
      source: "user_form",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Auto-vote: the proposer counts as 1 vote
  await admin.from("feature_votes").insert({
    feature_request_id: feature.id,
    user_id: user.id,
  });

  return NextResponse.json({ ok: true, feature });
}
