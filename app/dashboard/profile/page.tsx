import { createClient, createAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProfileContent } from "@/components/dashboard/profile-content";
import { SiteConfig } from "@/site-config";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/stripe";

type PriceInfo = {
  amount: number;
  currency: string;
  interval: "month" | "year";
};

type PricesResponse = {
  monthly: PriceInfo;
  annual: PriceInfo;
  plus: {
    monthly: PriceInfo;
    annual: PriceInfo | null;
  } | null;
  pro: {
    monthly: PriceInfo;
    annual: PriceInfo;
  };
};

async function fetchStripePrices(): Promise<PricesResponse> {
  const stripe = getStripe();

  const [proMonthly, proAnnual, plusMonthly, plusAnnual] = await Promise.all([
    stripe.prices.retrieve(env.STRIPE_PRO_PRICE_ID),
    stripe.prices.retrieve(env.STRIPE_PRO_ANNUAL_PRICE_ID),
    env.STRIPE_PLUS_PRICE_ID
      ? stripe.prices.retrieve(env.STRIPE_PLUS_PRICE_ID)
      : null,
    env.STRIPE_PLUS_ANNUAL_PRICE_ID
      ? stripe.prices.retrieve(env.STRIPE_PLUS_ANNUAL_PRICE_ID)
      : null,
  ]);

  return {
    monthly: {
      amount: proMonthly.unit_amount ?? 0,
      currency: proMonthly.currency,
      interval: "month",
    },
    annual: {
      amount: proAnnual.unit_amount ?? 0,
      currency: proAnnual.currency,
      interval: "year",
    },
    plus: plusMonthly
      ? {
          monthly: {
            amount: plusMonthly.unit_amount ?? 0,
            currency: plusMonthly.currency,
            interval: "month",
          },
          annual: plusAnnual
            ? {
                amount: plusAnnual.unit_amount ?? 0,
                currency: plusAnnual.currency,
                interval: "year",
              }
            : null,
        }
      : null,
    pro: {
      monthly: {
        amount: proMonthly.unit_amount ?? 0,
        currency: proMonthly.currency,
        interval: "month",
      },
      annual: {
        amount: proAnnual.unit_amount ?? 0,
        currency: proAnnual.currency,
        interval: "year",
      },
    },
  };
}

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

  const [
    { data: profile },
    { data: referralRows },
    { data: platformConns },
    prices,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "subscription_status, trial_ends_at, stripe_customer_id, tts_voice, preferred_language, favorite_languages, max_channels, referral_code, notify_new_summaries_push, email_newsletter, email_announcements, newsletter_enabled, newsletter_hour, newsletter_full_summary, rss_token",
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
    fetchStripePrices(),
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
  const discordConnected = (platformConns ?? []).some(
    (c) => c.platform === "discord",
  );
  const slackConnected = (platformConns ?? []).some(
    (c) => c.platform === "slack",
  );

  const rssToken = profile?.rss_token ?? "";
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
      initialDiscordConnected={discordConnected}
      initialSlackConnected={slackConnected}
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
      initialFullSummary={profile?.newsletter_full_summary ?? false}
      rssToken={rssToken}
      initialPrices={prices}
    />
  );
}
