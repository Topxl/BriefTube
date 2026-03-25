import type { SupabaseClient } from "@supabase/supabase-js";
import { SiteConfig } from "@/site-config";
import { isProUser } from "@/lib/is-pro";

/**
 * Restore channels that were paused by the system (e.g. trial expiry, over-limit).
 * Preserves channels the user manually paused (paused_by_system = false).
 */
export async function restoreSystemPausedChannels(
  userId: string,
  supabase: SupabaseClient,
) {
  await supabase
    .from("subscriptions")
    .update({ active: true, paused_by_system: false })
    .eq("user_id", userId)
    .eq("paused_by_system", true);
}

export type UserPlan = {
  isPro: boolean;
  maxChannels: number;
};

/**
 * Fetch user's subscription plan status.
 * Returns whether user is pro/trial and their max active channels limit.
 */
export async function getUserPlan(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserPlan> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status, trial_ends_at, max_channels")
    .eq("id", userId)
    .single();

  const isPro = profile ? isProUser(profile) : false;
  const maxChannels = profile?.max_channels ?? SiteConfig.freeChannelsLimit;

  return { isPro, maxChannels };
}
