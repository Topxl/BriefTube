import { createAdminClient } from "@/lib/supabase/server";
import { isProUser } from "@/lib/is-pro";
import { logger } from "@/lib/logger";

export const EXTENSION_FREE_DAILY_LIMIT = 10;

export type QuotaSnapshot = {
  isAuthenticated: boolean;
  isPro: boolean;
  limit: number;
  used: number;
  remaining: number;
  resetAtIso: string;
};

function tomorrowUtcMidnightIso(): string {
  const now = new Date();
  const next = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      0,
    ),
  );
  return next.toISOString();
}

export async function getUserQuotaSnapshot(
  userId: string,
): Promise<QuotaSnapshot> {
  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status, trial_ends_at, max_channels")
    .eq("id", userId)
    .single();
  const isPro = profile ? isProUser(profile) : false;

  if (isPro) {
    return {
      isAuthenticated: true,
      isPro: true,
      limit: Number.POSITIVE_INFINITY,
      used: 0,
      remaining: Number.POSITIVE_INFINITY,
      resetAtIso: tomorrowUtcMidnightIso(),
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("extension_user_usage")
    .select("summaries_count")
    .eq("user_id", userId)
    .eq("usage_date", today)
    .maybeSingle();
  const used = data?.summaries_count ?? 0;
  return {
    isAuthenticated: true,
    isPro: false,
    limit: EXTENSION_FREE_DAILY_LIMIT,
    used,
    remaining: Math.max(0, EXTENSION_FREE_DAILY_LIMIT - used),
    resetAtIso: tomorrowUtcMidnightIso(),
  };
}

export async function incrementUserUsage(userId: string): Promise<number> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("increment_extension_user_usage", {
    p_user_id: userId,
  });
  if (error) {
    logger.error("[extension-quota] user increment failed", error);
    throw error;
  }
  return data;
}
