import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProfileContent } from "@/components/dashboard/profile-content";
import { SiteConfig } from "@/site-config";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "subscription_status, trial_ends_at, stripe_customer_id, telegram_connected, tts_voice, max_channels, referral_code",
    )
    .eq("id", user.id)
    .single();

  const isActivePro = profile?.subscription_status === "active";

  const isTrial =
    profile?.trial_ends_at != null &&
    new Date(profile.trial_ends_at) > new Date();

  const trialEndsAt = profile?.trial_ends_at;
  const trialDaysLeft =
    isTrial && trialEndsAt
      ? Math.ceil(
          (new Date(trialEndsAt).getTime() - new Date().getTime()) / 86400000,
        )
      : 0;

  // Fetch referrals with referee emails
  const { data: referralRows } = await supabase
    .from("referrals")
    .select("id, status, reward_type, created_at, rewarded_at, referee_id")
    .eq("referrer_id", user.id)
    .order("created_at", { ascending: false });

  const refereeIds = (referralRows ?? []).map((r) => r.referee_id);
  const emailMap = new Map<string, string>();

  if (refereeIds.length > 0) {
    const { data: refereeProfiles } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", refereeIds);

    for (const p of refereeProfiles ?? []) {
      emailMap.set(p.id, p.email);
    }
  }

  function maskEmail(email: string): string {
    const [local, domain] = email.split("@");
    if (!local || !domain) return "***@***";
    return `${local.slice(0, 2)}***@${domain}`;
  }

  const referrals = (referralRows ?? []).map((r) => ({
    maskedEmail: maskEmail(emailMap.get(r.referee_id) ?? ""),
    status: r.status,
    rewardType: r.reward_type,
    createdAt: r.created_at,
    rewardedAt: r.rewarded_at,
  }));

  return (
    <ProfileContent
      email={user.email ?? ""}
      isTrial={isTrial}
      isActivePro={isActivePro}
      trialDaysLeft={trialDaysLeft}
      hasStripeCustomer={!!profile?.stripe_customer_id}
      initialTelegramConnected={profile?.telegram_connected ?? false}
      initialVoice={profile?.tts_voice ?? SiteConfig.defaultTtsVoice}
      maxChannels={profile?.max_channels ?? SiteConfig.freeChannelsLimit}
      referralCode={profile?.referral_code ?? ""}
      referrals={referrals}
    />
  );
}
