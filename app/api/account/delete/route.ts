import { authRoute } from "@/lib/zod-route";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { logger } from "@/lib/logger";

export const DELETE = authRoute.handler(async (_req, { ctx }) => {
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
    .select("stripe_subscription_id")
    .eq("id", userId)
    .single();

  if (profile?.stripe_subscription_id) {
    try {
      await stripe.subscriptions.cancel(profile.stripe_subscription_id);
      logger.info(`Stripe subscription cancelled for user: ${userId}`);
    } catch (err) {
      // Log but continue — subscription may already be cancelled
      logger.error(
        "Failed to cancel Stripe subscription during account deletion:",
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
  await supabase
    .from("referrals")
    .delete()
    .or(`referrer_id.eq.${userId},referee_id.eq.${userId}`);
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
