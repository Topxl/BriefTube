import { authRoute } from "@/lib/zod-route";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { logger } from "@/lib/logger";
import { checkRateLimit, heavyRateLimit } from "@/lib/rate-limit";

export const DELETE = authRoute.handler(async (_req, { ctx }) => {
  const rateLimitResponse = await checkRateLimit(
    heavyRateLimit,
    `delete-account:${ctx.user.id}`,
  );
  if (rateLimitResponse) return rateLimitResponse;

  const supabase = await createClient();
  const admin = createAdminClient();
  const userId = ctx.user.id;

  // 0. Record email to prevent trial abuse on re-signup
  if (ctx.user.email) {
    await admin
      .from("deleted_accounts")
      .upsert({ email: ctx.user.email }, { onConflict: "email" });
  }

  // 1. Cancel Stripe subscription if active (before deleting profile)
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_subscription_id, stripe_customer_id")
    .eq("id", userId)
    .single();

  if (profile?.stripe_subscription_id) {
    try {
      await stripe.subscriptions.cancel(profile.stripe_subscription_id);
      logger.info(`Stripe subscription cancelled for user: ${userId}`);
    } catch (err) {
      logger.error(
        "Failed to cancel Stripe subscription during account deletion:",
        err,
      );
    }
  } else if (profile?.stripe_customer_id) {
    // Fallback: cancel all active subscriptions by customer ID
    // (handles case where stripe_subscription_id is missing due to webhook delay)
    try {
      const subscriptions = await stripe.subscriptions.list({
        customer: profile.stripe_customer_id,
        status: "active",
      });
      await Promise.all(
        subscriptions.data.map(async (sub) =>
          stripe.subscriptions.cancel(sub.id).then(() => {
            logger.info(
              `Stripe subscription ${sub.id} cancelled via customer fallback for user: ${userId}`,
            );
          }),
        ),
      );
    } catch (err) {
      logger.error(
        "Failed to cancel Stripe subscriptions via customer ID fallback:",
        err,
      );
    }
  }

  // 2. Delete user data in FK → PK order
  await supabase.from("deliveries").delete().eq("user_id", userId);
  await supabase.from("subscriptions").delete().eq("user_id", userId);
  await supabase.from("list_follows").delete().eq("user_id", userId);
  await supabase.from("list_stars").delete().eq("user_id", userId);
  await supabase.from("channel_lists").delete().eq("created_by", userId);
  await supabase.from("referrals").delete().eq("referrer_id", userId);
  await supabase.from("referrals").delete().eq("referee_id", userId);
  await supabase.from("profiles").delete().eq("id", userId);

  // 3. Delete the auth user (requires service role key)
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    logger.error("Failed to delete auth user:", error);
    throw new Error(`Failed to delete auth user: ${error.message}`);
  }

  logger.info(`Account deleted for user: ${userId}`);
  return { success: true };
});
