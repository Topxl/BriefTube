import { z } from "zod";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { logger } from "@/lib/logger";
import { checkRateLimit, authRateLimit } from "@/lib/rate-limit";

const COUPON_ID = "RETENTION_50_3M";

const bodySchema = z.object({
  reason: z.string().min(1),
  customMessage: z.string().optional(),
  acceptOffer: z.boolean(),
});

async function ensureRetentionCoupon() {
  const stripe = getStripe();
  try {
    await stripe.coupons.create({
      id: COUPON_ID,
      percent_off: 50,
      duration: "repeating",
      duration_in_months: 3,
    });
  } catch {
    // Coupon already exists — reuse it
  }
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = await checkRateLimit(
    authRateLimit,
    `cancel:${user.id}`,
  );
  if (rateLimitResponse) return rateLimitResponse;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const { reason, customMessage, acceptOffer } = parsed.data;
  const userId = user.id;
  const stripe = getStripe();

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_subscription_id")
    .eq("id", userId)
    .single();

  // Save feedback regardless of choice
  const { error: feedbackError } = await supabase
    .from("cancellation_feedbacks")
    .insert({
      user_id: userId,
      reason,
      custom_message: customMessage ?? null,
      offer_accepted: acceptOffer,
    });

  if (feedbackError) {
    logger.error("Failed to save cancellation feedback:", feedbackError);
  }

  if (acceptOffer) {
    if (profile?.stripe_subscription_id) {
      await ensureRetentionCoupon();
      try {
        await stripe.subscriptions.update(profile.stripe_subscription_id, {
          discounts: [{ coupon: COUPON_ID }],
        });
        logger.info(`Retention offer accepted for user: ${userId}`);
      } catch (err) {
        logger.error("Failed to apply retention coupon:", err);
        return NextResponse.json(
          { error: "Failed to apply retention offer" },
          { status: 500 },
        );
      }
    }
    return NextResponse.json({ accepted: true });
  }

  // Cancel at period end: the subscription stays active until the current
  // billing period ends, then Stripe fires customer.subscription.deleted which
  // downgrades the profile in the webhook handler. Keeps revenue for the paid
  // period and leaves a rescue window for win-back.
  if (profile?.stripe_subscription_id) {
    try {
      await stripe.subscriptions.update(profile.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
      logger.info(`Subscription scheduled for cancellation: ${userId}`);
    } catch (err) {
      logger.error("Failed to schedule subscription cancellation:", err);
      return NextResponse.json(
        { error: "Failed to cancel subscription" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ cancelled: true });
}
