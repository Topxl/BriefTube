import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/auth/require-admin-api";
import { notifyUserFeatureShipped } from "@/lib/lea/notifications";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/features/[id]/notify-shipped
 * Send an email to every user who voted for the feature (and the original
 * proposer), telling them it's been shipped. Marks
 * shipped_notification_sent=true so we don't spam them twice.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const admin = createAdminClient();

  // Fetch the feature
  const { data: feature } = await admin
    .from("feature_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!feature) {
    return NextResponse.json({ error: "Feature not found" }, { status: 404 });
  }
  if (feature.status !== "shipped") {
    return NextResponse.json(
      { error: "Feature is not in shipped status" },
      { status: 409 },
    );
  }
  if (feature.shipped_notification_sent) {
    return NextResponse.json({
      ok: true,
      already_sent: true,
      notified: 0,
    });
  }

  // Collect all user_ids to notify: voters + proposer
  const userIds = new Set<string>();
  if (feature.user_id) userIds.add(feature.user_id);

  const { data: votes } = await admin
    .from("feature_votes")
    .select("user_id")
    .eq("feature_request_id", id);
  for (const v of votes ?? []) {
    userIds.add(v.user_id);
  }

  if (userIds.size === 0) {
    await admin
      .from("feature_requests")
      .update({ shipped_notification_sent: true })
      .eq("id", id);
    return NextResponse.json({ ok: true, notified: 0 });
  }

  // Fetch their emails (filter out users who opted out of announcements)
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email, email_announcements")
    .in("id", Array.from(userIds));

  const recipients = (profiles ?? []).filter(
    (p) => p.email_announcements !== false,
  );

  // Send all emails in parallel
  await Promise.all(
    recipients.map(async (r) =>
      notifyUserFeatureShipped({
        userEmail: r.email,
        featureTitle: feature.title,
        featureDescription: feature.description,
        featureId: feature.id,
      }),
    ),
  );

  // Mark notification sent
  await admin
    .from("feature_requests")
    .update({ shipped_notification_sent: true })
    .eq("id", id);

  return NextResponse.json({ ok: true, notified: recipients.length });
}
