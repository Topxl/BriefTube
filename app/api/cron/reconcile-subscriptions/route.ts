import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { SiteConfig } from "@/site-config";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const maxDuration = 300;

export const GET = async (req: NextRequest) => {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${env.CRON_SECRET}`;

  if (!env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Fetch all profiles that claim to have an active subscription
  const { data: activePaidProfiles, error } = await admin
    .from("profiles")
    .select("id, stripe_subscription_id, subscription_status")
    .in("subscription_status", ["active", "trialing", "past_due"]);

  if (error) {
    logger.error("reconcile: failed to fetch profiles", error);
    return NextResponse.json({ error: "DB fetch failed" }, { status: 500 });
  }

  const reconcileProfile = async (profile: {
    id: string;
    stripe_subscription_id: string | null;
    subscription_status: string | null;
  }): Promise<"fixed" | "ok"> => {
    if (!profile.stripe_subscription_id) {
      // Profile claims active but has no subscription ID — revert to free
      await admin
        .from("profiles")
        .update({
          subscription_status: "free",
          max_channels: SiteConfig.freeChannelsLimit,
        })
        .eq("id", profile.id);
      logger.warn(`reconcile: reverted profile with no sub_id: ${profile.id}`);
      return "fixed";
    }

    const sub = await stripe.subscriptions.retrieve(
      profile.stripe_subscription_id,
    );

    const isActive = sub.status === "active" || sub.status === "trialing";
    const expectedStatus = sub.status;
    const expectedChannels = isActive ? 999 : SiteConfig.freeChannelsLimit;

    if ((profile.subscription_status ?? "free") !== expectedStatus) {
      await admin
        .from("profiles")
        .update({
          subscription_status: expectedStatus,
          max_channels: expectedChannels,
        })
        .eq("id", profile.id);
      logger.info(
        `reconcile: fixed profile ${profile.id}: ${profile.subscription_status ?? "null"} → ${expectedStatus}`,
      );
      return "fixed";
    }

    return "ok";
  };

  const results = await Promise.allSettled(
    activePaidProfiles.map(reconcileProfile),
  );

  const fixed = results.filter(
    (r) => r.status === "fulfilled" && r.value === "fixed",
  ).length;
  const errors = results.filter((r) => r.status === "rejected").length;

  results
    .filter((r) => r.status === "rejected")
    .forEach((r) =>
      logger.error(
        "reconcile: profile error",
        (r as PromiseRejectedResult).reason,
      ),
    );

  logger.info(`reconcile: done — fixed=${fixed}, errors=${errors}`);
  return NextResponse.json({ ok: true, fixed, errors });
};
