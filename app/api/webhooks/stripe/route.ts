import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  getRequestIp,
  publicRateLimit,
} from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { updateSubscriptionStatus } from "@/lib/stripe/helpers";
import { SiteConfig } from "@/site-config";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { sendEmail } from "@/lib/mail/send-email";
import { UpgradeEmail } from "@/components/emails/upgrade-email";
import { PaymentFailedEmail } from "@/components/emails/payment-failed-email";
import { captureServerEvent } from "@/lib/posthog/server";
import { restoreSystemPausedChannels } from "@/lib/subscriptions";

export const maxDuration = 300;

export const POST = async (req: NextRequest) => {
  const rateLimitResponse = await checkRateLimit(
    publicRateLimit,
    `wh-stripe:${getRequestIp(req)}`,
  );
  if (rateLimitResponse) return rateLimitResponse;
  const headerList = await headers();
  const body = await req.text();

  const stripeSignature = headerList.get("stripe-signature");

  if (!stripeSignature) {
    return NextResponse.json(
      { error: "Missing Stripe signature" },
      { status: 400 },
    );
  }

  if (!env.STRIPE_WEBHOOK_SECRET) {
    logger.error("STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 },
    );
  }

  let event: Stripe.Event | null = null;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      stripeSignature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err: unknown) {
    logger.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Invalid Stripe webhook signature" },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await checkoutSessionCompleted(event.data.object);
        break;
      case "checkout.session.async_payment_succeeded":
        await checkoutSessionCompleted(event.data.object);
        break;
      case "checkout.session.async_payment_failed":
        await checkoutSessionAsyncPaymentFailed(event.data.object);
        break;
      case "checkout.session.expired":
        await checkoutSessionExpired(event.data.object);
        break;
      case "customer.subscription.updated":
        await customerSubscriptionUpdated(event.data.object);
        break;
      case "customer.subscription.deleted":
        await customerSubscriptionDeleted(event.data.object);
        break;
      case "invoice.payment_failed":
        await invoicePaymentFailed(event.data.object);
        break;
      default:
        logger.info(`Unhandled event type: ${event.type}`);
        break;
    }

    // Log successful webhook processing
    try {
      const supabase = createAdminClient();
      await supabase.from("webhook_events").insert({
        event_id: event.id,
        event_type: event.type,
        status: "processed",
      });
    } catch (logError) {
      logger.error("Failed to log webhook event to database:", logError);
      // Non-fatal: don't let logging failure affect webhook response
    }
  } catch (error) {
    logger.error(`Error handling webhook event ${event.type}:`, error);

    // Log failed webhook processing
    try {
      const supabase = createAdminClient();
      await supabase.from("webhook_events").insert({
        event_id: event.id,
        event_type: event.type,
        status: "failed",
        error_message: error instanceof Error ? error.message : String(error),
      });
    } catch (logError) {
      logger.error("Failed to log webhook error to database:", logError);
      // Non-fatal: don't let logging failure affect webhook response
    }

    return NextResponse.json(
      { error: "Webhook handler failed", eventType: event.type },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
  });
};

const checkoutSessionCompleted = async (
  sessionData: Stripe.Checkout.Session,
) => {
  const session = sessionData;

  if (!session.customer || !session.subscription) {
    logger.warn("Missing customer or subscription in checkout session");
    return;
  }

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer.id;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription.id;

  const supabase = createAdminClient();

  // Find user by Stripe customer ID first, then fallback to metadata.userId
  let profile: {
    id: string;
    email: string;
    stripe_customer_id: string | null;
    referred_by: string | null;
  } | null = null;

  const { data: profileByCustomer } = await supabase
    .from("profiles")
    .select("id, email, stripe_customer_id, referred_by")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  profile = profileByCustomer ?? null;

  if (!profile && session.metadata?.userId) {
    const { data: profileByUserId } = await supabase
      .from("profiles")
      .select("id, email, stripe_customer_id, referred_by")
      .eq("id", session.metadata.userId)
      .maybeSingle();
    profile = profileByUserId ?? null;
  }

  if (!profile) {
    logger.error(`User not found for customer ID: ${customerId}`);
    return;
  }

  // Get the subscription from Stripe
  const stripeSubscription =
    await stripe.subscriptions.retrieve(subscriptionId);

  logger.info("Checkout session completed", {
    userId: profile.id,
    email: profile.email,
    subscriptionId,
    status: stripeSubscription.status,
  });

  // Save customer ID if missing
  if (!profile.stripe_customer_id) {
    await supabase
      .from("profiles")
      .update({
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
      })
      .eq("id", profile.id);
  }

  // Update subscription status (always active on checkout completion)
  await updateSubscriptionStatus(
    supabase,
    profile.id,
    stripeSubscription.status,
    true,
  );

  // Mark any abandoned checkout rows as recovered
  await supabase
    .from("abandoned_checkouts")
    .update({ recovered_at: new Date().toISOString() })
    .eq("user_id", profile.id)
    .is("recovered_at", null);

  // Restore only system-paused channels — preserve manual user pauses
  await restoreSystemPausedChannels(profile.id, supabase);

  logger.info(`Subscription activated for user: ${profile.id}`);

  await captureServerEvent({
    distinctId: profile.id,
    event: "subscription_activated",
    properties: {
      email: profile.email,
      subscription_id: subscriptionId,
      plan: "pro",
    },
  });

  // Send upgrade confirmation email
  if (profile.email) {
    await sendEmail({
      to: profile.email,
      subject: "Your BriefTube Pro subscription is active",
      html: UpgradeEmail(),
    });
  }

  // Reward referrer if applicable
  if (profile.referred_by) {
    const admin = supabase; // already admin client

    const { data: referral } = await admin
      .from("referrals")
      .select("id, referrer_id, status")
      .eq("referee_id", profile.id)
      .eq("status", "pending")
      .maybeSingle();

    if (referral) {
      const interval =
        stripeSubscription.items.data[0]?.plan?.interval ?? "month";
      const amountTotal = session.amount_total ?? 0;
      const { monthlyRewardFraction, annualRewardMonths, currency } =
        SiteConfig.referral;
      const creditAmount =
        interval === "year"
          ? Math.round(amountTotal / (12 / annualRewardMonths))
          : Math.round(amountTotal * monthlyRewardFraction);
      const rewardType = interval === "year" ? "free_month" : "discount_20pct";

      const { data: referrer } = await admin
        .from("profiles")
        .select("email, stripe_customer_id")
        .eq("id", referral.referrer_id)
        .single();

      let referrerCustomerId = referrer?.stripe_customer_id;
      if (!referrerCustomerId && referrer?.email) {
        const customer = await stripe.customers.create({
          email: referrer.email,
          metadata: { userId: referral.referrer_id },
        });
        referrerCustomerId = customer.id;
        await admin
          .from("profiles")
          .update({ stripe_customer_id: referrerCustomerId })
          .eq("id", referral.referrer_id);
      }

      if (referrerCustomerId && creditAmount > 0) {
        await stripe.customers.createBalanceTransaction(referrerCustomerId, {
          amount: -creditAmount,
          currency,
          description: `Referral reward (${rewardType}) — user converted`,
        });

        await admin
          .from("referrals")
          .update({
            status: "rewarded",
            reward_type: rewardType,
            rewarded_at: new Date().toISOString(),
          })
          .eq("id", referral.id);

        logger.info("Referral rewarded", {
          referrerId: referral.referrer_id,
          refereeId: profile.id,
          creditAmount,
          rewardType,
        });
      }
    }
  }
};

const checkoutSessionAsyncPaymentFailed = async (
  sessionData: Stripe.Checkout.Session,
) => {
  const session = sessionData;

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;

  if (!customerId) {
    logger.warn("async_payment_failed missing customer");
    return;
  }

  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (!profile?.email) {
    logger.error(`User not found for customer ID: ${customerId}`);
    return;
  }

  logger.info(`Async payment failed for user: ${profile.id}`);

  await sendEmail({
    to: profile.email,
    subject: "Your BriefTube payment failed",
    html: PaymentFailedEmail(),
  });
};

const checkoutSessionExpired = async (sessionData: Stripe.Checkout.Session) => {
  const session = sessionData;

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;

  const userIdFromMeta = session.metadata?.userId;

  if (!customerId && !userIdFromMeta) {
    logger.warn("checkout.session.expired missing customer and userId");
    return;
  }

  const supabase = createAdminClient();

  let userId: string | null = userIdFromMeta ?? null;

  if (!userId && customerId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    userId = profile?.id ?? null;
  }

  if (!userId) {
    logger.warn(
      `checkout.session.expired: user not found for customer ${customerId}`,
    );
    return;
  }

  const plan =
    typeof session.metadata?.plan === "string" ? session.metadata.plan : null;
  const interval =
    typeof session.metadata?.interval === "string"
      ? session.metadata.interval
      : null;

  const { error: insertError } = await supabase
    .from("abandoned_checkouts")
    .insert({
      user_id: userId,
      stripe_session_id: session.id,
      plan,
      interval,
      amount_total: session.amount_total,
      currency: session.currency,
    });

  if (insertError && insertError.code !== "23505") {
    logger.error("Failed to insert abandoned_checkouts row:", insertError);
  }

  await captureServerEvent({
    distinctId: userId,
    event: "checkout_abandoned",
    properties: {
      session_id: session.id,
      plan,
      interval,
      amount_total: session.amount_total,
      currency: session.currency,
    },
  });

  logger.info(`Checkout session expired tracked for user: ${userId}`);
};

const customerSubscriptionUpdated = async (
  subscriptionData: Stripe.Subscription,
) => {
  const subscription = subscriptionData;

  logger.info("Processing customer.subscription.updated:", subscription.id);

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const supabase = createAdminClient();

  // Find user by Stripe customer ID
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!profile) {
    logger.error(`User not found for customer ID: ${customerId}`);
    return;
  }

  const isActive =
    subscription.status === "active" || subscription.status === "trialing";

  // Update subscription status and max_channels accordingly
  await updateSubscriptionStatus(
    supabase,
    profile.id,
    subscription.status,
    isActive,
  );

  // Restore only system-paused channels — preserve manual user pauses
  if (isActive) {
    await restoreSystemPausedChannels(profile.id, supabase);
  }

  logger.info(
    `Subscription updated: ${subscription.id}, status: ${subscription.status}`,
  );
};

const customerSubscriptionDeleted = async (
  subscriptionData: Stripe.Subscription,
) => {
  const subscription = subscriptionData;

  logger.info("Processing customer.subscription.deleted:", subscription.id);

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const supabase = createAdminClient();

  // Find user by Stripe customer ID
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!profile) {
    logger.error(`User not found for customer ID: ${customerId}`);
    return;
  }

  // Revert to free plan
  await updateSubscriptionStatus(supabase, profile.id, "free", false);

  // Clear subscription ID
  await supabase
    .from("profiles")
    .update({ stripe_subscription_id: null })
    .eq("id", profile.id);

  logger.info(
    `Subscription canceled and reverted to free plan: ${subscription.id}`,
  );
};

const invoicePaymentFailed = async (invoiceData: Stripe.Invoice) => {
  const customerId =
    typeof invoiceData.customer === "string"
      ? invoiceData.customer
      : invoiceData.customer?.id;

  if (!customerId) {
    logger.warn("Missing customer in invoice.payment_failed event");
    return;
  }

  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!profile?.email) {
    logger.error(`User not found for customer ID: ${customerId}`);
    return;
  }

  logger.info(`Payment failed for user: ${profile.id}`);

  await sendEmail({
    to: profile.email,
    subject: "Your BriefTube payment failed",
    html: PaymentFailedEmail(),
  });
};
