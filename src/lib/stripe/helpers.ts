import type { SupabaseClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";
import { SiteConfig } from "@/site-config";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";

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
 * Determine max_channels based on Stripe subscription's price ID.
 * Returns: Plus = 50, Pro = 999
 */
export function getMaxChannelsForPriceId(priceId: string): number {
  if (env.STRIPE_PLUS_PRICE_ID && priceId === env.STRIPE_PLUS_PRICE_ID) {
    return SiteConfig.plusChannelsLimit;
  }
  if (
    env.STRIPE_PLUS_ANNUAL_PRICE_ID &&
    priceId === env.STRIPE_PLUS_ANNUAL_PRICE_ID
  ) {
    return SiteConfig.plusChannelsLimit;
  }
  // Default to Pro unlimited
  return 999;
}

/**
 * Update subscription status and max_channels in profiles table.
 * isActive = true → max_channels = 999 (unlimited)
 * isActive = false → max_channels = SiteConfig.freeChannelsLimit
 * Optionally pass maxChannels to override tier-based logic
 */
export async function updateSubscriptionStatus(
  supabase: SupabaseClient,
  userId: string,
  status: string,
  isActive: boolean,
  maxChannels?: number,
): Promise<void> {
  const channels =
    maxChannels !== undefined
      ? maxChannels
      : isActive
        ? 999
        : SiteConfig.freeChannelsLimit;

  await supabase
    .from("profiles")
    .update({
      subscription_status: status,
      max_channels: channels,
    })
    .eq("id", userId);

  logger.debug(`Updated subscription status for user ${userId}`, {
    status,
    isActive,
    maxChannels: channels,
  });
}
