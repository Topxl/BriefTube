import type { SupabaseClient } from "@supabase/supabase-js";

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
