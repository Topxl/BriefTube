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

  const admin = createAdminClient();

  const [{ data: profile }, { data: referralRows }, { data: platformConns }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "subscription_status, trial_ends_at, stripe_customer_id, tts_voice, preferred_language, favorite_languages, max_channels, referral_code, notify_new_summaries_push, email_newsletter, email_announcements, newsletter_enabled, newsletter_hour",
        )
        .eq("id", user.id)
        .single(),
      supabase
        .from("referrals")
        .select("referee_id, status")
        .eq("referrer_id", user.id),
      supabase
        .from("platform_connections")
        .select("platform, connected, credentials, external_id")
        .eq("user_id", user.id)
        .eq("connected", true),
    ]);

  const telegramConnected = (platformConns ?? []).some(
    (c) => c.platform === "telegram",
  );
  const notionConnected = (platformConns ?? []).some(
    (c) => c.platform === "notion",
  );
  const notionDatabaseName = (platformConns ?? []).find(
    (c) => c.platform === "notion",
  )?.credentials as { database_name?: string } | null;
  const whatsappConnected = (platformConns ?? []).some(
    (c) => c.platform === "whatsapp",
  );
  const whatsappPhone =
    (platformConns ?? []).find((c) => c.platform === "whatsapp")?.external_id ??
    "";

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
      initialTelegramConnected={telegramConnected}
      initialNotionConnected={notionConnected}
      initialNotionDatabaseName={notionDatabaseName?.database_name ?? ""}
      initialWhatsappConnected={whatsappConnected}
      initialWhatsappPhone={whatsappPhone}
      initialVoice={profile?.tts_voice ?? SiteConfig.defaultTtsVoice}
      initialLanguage={
        profile?.preferred_language ?? SiteConfig.defaultLanguage
      }
      initialFavorites={profile?.favorite_languages ?? []}
      maxChannels={profile?.max_channels ?? SiteConfig.freeChannelsLimit}
      referralCode={profile?.referral_code ?? ""}
      referralStats={referralStats}
      isAdmin={!!env.ADMIN_USER_ID && user.id === env.ADMIN_USER_ID}
      defaultInterval={defaultInterval}
      paymentSuccess={paymentSuccess}
      initialPushEnabled={profile?.notify_new_summaries_push ?? true}
      initialNewsletter={profile?.email_newsletter ?? true}
      initialAnnouncements={profile?.email_announcements ?? true}
      initialDailyDigest={profile?.newsletter_enabled ?? true}
      initialDigestHour={profile?.newsletter_hour ?? 8}
    />
  );
}
