import type { SupabaseClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";
import { SiteConfig } from "@/site-config";
import { logger } from "@/lib/logger";

/**
 * Find or create a Stripe customer by user ID and email.
 * If the user doesn't have a stripe_customer_id, looks up in Stripe by email.
 * If found, saves it. If not found, returns null.
 */
export async function getOrFindStripeCustomerId(
  supabase: SupabaseClient,
  userId: string,
  userEmail: string,
): Promise<string | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, email")
    .eq("id", userId)
    .single();

  let customerId = profile?.stripe_customer_id;

  // Fallback: look up customer by email in Stripe if ID is missing
  if (!customerId && (profile?.email ?? userEmail)) {
    const email = profile?.email ?? userEmail ?? "";
    const customers = await stripe.customers.list({ email, limit: 1 });
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      // Save it for next time
      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", userId);
    }
  }

  return customerId ?? null;
}

/**
 * Update subscription status and max_channels in profiles table.
 * isActive = true → max_channels = 999 (unlimited)
 * isActive = false → max_channels = SiteConfig.freeChannelsLimit
 */
export async function updateSubscriptionStatus(
  supabase: SupabaseClient,
  userId: string,
  status: string,
  isActive: boolean,
): Promise<void> {
  const maxChannels = isActive ? 999 : SiteConfig.freeChannelsLimit;

  await supabase
    .from("profiles")
    .update({
      subscription_status: status,
      max_channels: maxChannels,
    })
    .eq("id", userId);

  logger.debug(`Updated subscription status for user ${userId}`, {
    status,
    isActive,
    maxChannels,
  });
}
