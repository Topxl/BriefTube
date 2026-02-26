import { createClient, createAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProfileContent } from "@/components/dashboard/profile-content";
import { SiteConfig } from "@/site-config";
import { env } from "@/lib/env";

export default async function ProfilePage(props: {
  searchParams: Promise<{ success?: string; annual?: string }>;
}) {
  const searchParams = await props.searchParams;
  const paymentSuccess = searchParams.success === "true";
  const defaultInterval =
    searchParams.annual === "true" ? ("year" as const) : undefined;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "subscription_status, trial_ends_at, stripe_customer_id, telegram_connected, tts_voice, preferred_language, max_channels, referral_code",
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

  // Fetch referral stats (no personal data exposed)
  const admin = createAdminClient();

  const { data: referralRows } = await supabase
    .from("referrals")
    .select("referee_id, status")
    .eq("referrer_id", user.id);

  const refereeIds = (referralRows ?? []).map((r) => r.referee_id);

  let onTrial = 0;
  let activePro = 0;

  if (refereeIds.length > 0) {
    const { data: refereeProfiles } = await admin
      .from("profiles")
      .select("subscription_status, trial_ends_at")
      .in("id", refereeIds);

    for (const p of refereeProfiles ?? []) {
      if (p.subscription_status === "active") {
        activePro++;
      } else if (p.trial_ends_at && new Date(p.trial_ends_at) > new Date()) {
        onTrial++;
      }
    }
  }

  const referralStats = {
    total: referralRows?.length ?? 0,
    onTrial,
    activePro,
    rewarded: (referralRows ?? []).filter((r) => r.status === "rewarded")
      .length,
  };

  return (
    <ProfileContent
      email={user.email ?? ""}
      isTrial={isTrial}
      isActivePro={isActivePro}
      trialDaysLeft={trialDaysLeft}
      hasStripeCustomer={!!profile?.stripe_customer_id}
      initialTelegramConnected={profile?.telegram_connected ?? false}
      initialVoice={profile?.tts_voice ?? SiteConfig.defaultTtsVoice}
      initialLanguage={
        profile?.preferred_language ?? SiteConfig.defaultLanguage
      }
      maxChannels={profile?.max_channels ?? SiteConfig.freeChannelsLimit}
      referralCode={profile?.referral_code ?? ""}
      referralStats={referralStats}
      isAdmin={!!env.ADMIN_USER_ID && user.id === env.ADMIN_USER_ID}
      defaultInterval={defaultInterval}
      paymentSuccess={paymentSuccess}
    />
  );
}
