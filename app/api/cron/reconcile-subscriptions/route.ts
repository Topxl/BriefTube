import { checkCronAuth } from "@/lib/cron/auth";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { updateSubscriptionStatus } from "@/lib/stripe/helpers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const maxDuration = 300;

export const GET = async (req: NextRequest) => {
  const unauthorized = checkCronAuth(req);
  if (unauthorized) return unauthorized;

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
      await updateSubscriptionStatus(admin, profile.id, "free", false);
      logger.warn(`reconcile: reverted profile with no sub_id: ${profile.id}`);
      return "fixed";
    }

    const sub = await stripe.subscriptions.retrieve(
      profile.stripe_subscription_id,
    );

    const isActive = sub.status === "active" || sub.status === "trialing";
    const expectedStatus = sub.status;

    if ((profile.subscription_status ?? "free") !== expectedStatus) {
      await updateSubscriptionStatus(
        admin,
        profile.id,
        expectedStatus,
        isActive,
      );
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
