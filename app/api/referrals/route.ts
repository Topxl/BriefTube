import { authRoute } from "@/lib/zod-route";
import { checkRateLimit, authRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***@***";
  const visible = local.slice(0, 2);
  return `${visible}***@${domain}`;
}

export const GET = authRoute.handler(async (_req, { ctx }) => {
  const rateLimitResponse = await checkRateLimit(authRateLimit, `referrals:${ctx.user.id}`);
  if (rateLimitResponse) return rateLimitResponse;

  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("referral_code")
    .eq("id", ctx.user.id)
    .single();

  const { data: referrals } = await supabase
    .from("referrals")
    .select("id, status, reward_type, created_at, rewarded_at, referee_id")
    .eq("referrer_id", ctx.user.id)
    .order("created_at", { ascending: false });

  if (!referrals || referrals.length === 0) {
    return {
      referralCode: profile?.referral_code ?? null,
      referrals: [],
      totalReferred: 0,
      totalRewarded: 0,
    };
  }

  const refereeIds = referrals.map((r) => r.referee_id);
  const { data: refereeProfiles } = await supabase
    .from("profiles")
    .select("id, email")
    .in("id", refereeIds);

  const emailMap = new Map<string, string>(
    (refereeProfiles ?? []).map((p) => [p.id, p.email]),
  );

  const enriched = referrals.map((r) => ({
    maskedEmail: maskEmail(emailMap.get(r.referee_id) ?? ""),
    status: r.status,
    rewardType: r.reward_type,
    createdAt: r.created_at,
    rewardedAt: r.rewarded_at,
  }));

  const totalRewarded = referrals.filter((r) => r.status === "rewarded").length;

  return {
    referralCode: profile?.referral_code ?? null,
    referrals: enriched,
    totalReferred: referrals.length,
    totalRewarded,
  };
});
