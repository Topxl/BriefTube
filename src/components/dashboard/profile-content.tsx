"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

import { Button } from "@/components/ui/button";
import Link from "next/link";

const DeliverySection = dynamic(
  async () =>
    import("@/components/dashboard/delivery-section").then((m) => ({
      default: m.DeliverySection,
    })),
  { ssr: false },
);

const AudioSettingsSection = dynamic(
  async () =>
    import("@/components/dashboard/delivery-section").then((m) => ({
      default: m.AudioSettingsSection,
    })),
  { ssr: false },
);

const NotificationsSection = dynamic(
  async () =>
    import("@/components/dashboard/notifications-section").then((m) => ({
      default: m.NotificationsSection,
    })),
  { ssr: false },
);

const SummaryPreferencesSection = dynamic(
  async () =>
    import("@/components/dashboard/summary-preferences-section").then((m) => ({
      default: m.SummaryPreferencesSection,
    })),
  { ssr: false },
);

const ReferralSection = dynamic(
  async () =>
    import("@/components/dashboard/referral-section").then((m) => ({
      default: m.ReferralSection,
    })),
  { ssr: false },
);
import { Trash2, ShieldAlert, Loader2, Rss, Copy, Check } from "@/lib/icons";
import { SiteConfig } from "@/site-config";
import { formatCurrency } from "@/lib/format";

const PODCAST_APPS = [
  {
    name: "Overcast",
    href: (url: string) =>
      `https://overcast.fm/x-callback-url/add?url=${encodeURIComponent(url)}`,
  },
  {
    name: "Pocket Casts",
    href: (url: string) => `https://pca.st/add?feed=${encodeURIComponent(url)}`,
  },
  {
    name: "Apple Podcasts",
    href: (url: string) => `podcast://${url.replace(/^https?:\/\//, "")}`,
  },
  {
    name: "Castro",
    href: (url: string) =>
      `castro://subscribe/${url.replace(/^https?:\/\//, "")}`,
  },
] as const;

function PodcastFeedSection({
  rssToken,
  audioEnabled,
}: {
  rssToken: string;
  audioEnabled: boolean;
}) {
  const feedUrl = `${SiteConfig.prodUrl}/api/feed/${rssToken}`;
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    if (!audioEnabled) {
      toast.info(
        "Audio is not enabled. Your RSS feed will only contain text summaries, without audio for podcast apps.",
      );
    }
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="nm-inset-sm flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
            <Rss className="h-4 w-4 text-orange-400" />
          </div>
          <div>
            <p className="text-sm font-medium">Podcast feed</p>
            <p className="text-muted-foreground text-[11px]">
              Listen in your favorite podcast app
            </p>
          </div>
        </div>
        <button
          onClick={() => void handleCopy()}
          className="nm-raised-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-all"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-green-400" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy link
            </>
          )}
        </button>
      </div>
      <div className="flex flex-wrap gap-2 px-4 pb-3">
        {PODCAST_APPS.map((app) => (
          <a
            key={app.name}
            href={app.href(feedUrl)}
            target="_blank"
            rel="noopener noreferrer"
            className="nm-raised-sm text-muted-foreground hover:text-foreground rounded-full px-3 py-1 text-xs transition-colors"
          >
            {app.name}
          </a>
        ))}
      </div>
    </>
  );
}

type Interval = "month" | "year";
type Plan = "plus" | "pro";

type PriceInfo = { amount: number; currency: string };

type PricesData = {
  monthly: PriceInfo;
  annual: PriceInfo;
  plus?: {
    monthly: PriceInfo;
    annual: PriceInfo | null;
  } | null;
  pro?: {
    monthly: PriceInfo;
    annual: PriceInfo;
  };
};

import { dialogManager } from "@/features/dialog-manager/dialog-manager";
import { toast } from "sonner";
import { trackAdConversion } from "@/lib/gtag";

type ReferralStats = {
  total: number;
  onTrial: number;
  activePro: number;
  rewarded: number;
};

type ActivePlan = {
  tier: "plus" | "pro";
  interval: "month" | "year";
  amount: number;
  currency: string;
  subscriptionId: string;
  cancelAtPeriodEnd: boolean;
  periodEndDate: string | null;
};

type Props = {
  avatarUrl: string;
  email: string;
  isTrial: boolean;
  hasActiveSubscription: boolean;
  activePlan: ActivePlan | null;
  trialDaysLeft: number;
  hasStripeCustomer: boolean;
  initialTelegramConnected: boolean;
  initialNotionConnected: boolean;
  initialNotionDatabaseName?: string;
  initialWhatsappConnected: boolean;
  initialWhatsappPhone?: string;
  initialDiscordConnected: boolean;
  initialSlackConnected: boolean;
  initialVoice: string;
  initialLanguage: string;
  initialFavorites?: string[];
  maxChannels: number;
  referralCode?: string;
  referralStats?: ReferralStats;
  isAdmin?: boolean;
  defaultInterval?: Interval;
  paymentSuccess?: boolean;
  initialPushEnabled: boolean;
  initialNewsletter: boolean;
  initialAnnouncements: boolean;
  initialDailyDigest: boolean;
  initialDigestHour: number;
  initialFullSummary: boolean;
  rssToken: string;
  initialPrices: PricesData;
  initialSummaryLength: string;
  initialSummaryStyle: string;
  initialCustomInstructions: string;
  initialAudioEnabled: boolean;
};

export function ProfileContent({
  avatarUrl: _avatarUrl,
  email,
  isTrial,
  hasActiveSubscription,
  activePlan,
  trialDaysLeft,
  hasStripeCustomer,
  initialTelegramConnected,
  initialNotionConnected,
  initialNotionDatabaseName,
  initialWhatsappConnected,
  initialWhatsappPhone,
  initialDiscordConnected,
  initialSlackConnected,
  initialVoice,
  initialLanguage,
  initialFavorites,
  maxChannels: _maxChannels,
  referralCode,
  referralStats,
  isAdmin,
  defaultInterval,
  paymentSuccess,
  initialPushEnabled,
  initialNewsletter,
  initialAnnouncements,
  initialDailyDigest,
  initialDigestHour,
  initialFullSummary,
  rssToken,
  initialPrices,
  initialSummaryLength,
  initialSummaryStyle,
  initialCustomInstructions,
  initialAudioEnabled,
}: Props) {
  const router = useRouter();

  const [retryCount, setRetryCount] = useState(0);
  const [upgradePlan, setUpgradePlan] = useState<Plan>("plus");
  const [upgradeInterval, setUpgradeInterval] = useState<Interval>(
    defaultInterval ?? "month",
  );
  const [prices] = useState(initialPrices);
  const [referral, setReferral] = useState("");

  const isActivating =
    !!paymentSuccess && !hasActiveSubscription && retryCount < 10;

  useEffect(() => {
    const w = window as Window & {
      rewardful?: (event: string, cb: () => void) => void;
      Rewardful?: { referral: string };
    };
    w.rewardful?.("ready", () => {
      if (w.Rewardful?.referral) setReferral(w.Rewardful.referral);
    });
  }, []);

  useEffect(() => {
    if (!paymentSuccess) return;
    if (hasActiveSubscription) {
      const planName = activePlan?.tier === "plus" ? "Plus" : "Pro";
      trackAdConversion({
        email,
        value: activePlan?.amount,
        currency: activePlan?.currency,
        transactionId: activePlan?.subscriptionId,
      });
      toast.success(`You're now on ${planName}!`, {
        description:
          activePlan?.tier === "plus"
            ? `Enjoy up to ${SiteConfig.plusChannelsLimit} channels.`
            : "Enjoy unlimited channels and priority processing.",
        duration: 6000,
      });
      router.replace("/dashboard/profile");
      return;
    }
    // Webhook not yet processed — keep retrying every 3s (max 10 times = 30s)
    if (retryCount >= 10) return;
    const timer = setTimeout(() => {
      router.refresh();
      setRetryCount((c) => c + 1);
    }, 3000);
    return () => clearTimeout(timer);
  }, [
    paymentSuccess,
    hasActiveSubscription,
    activePlan,
    router,
    retryCount,
    email,
  ]);

  const hasPlus = !!prices.plus;

  const priceData =
    upgradePlan === "plus" && prices.plus
      ? upgradeInterval === "year" && prices.plus.annual
        ? prices.plus.annual
        : prices.plus.monthly
      : upgradeInterval === "year" && prices.pro
        ? prices.pro.annual
        : (prices.pro?.monthly ?? prices.monthly);

  const displayUpgradePrice = formatCurrency(
    priceData.amount,
    priceData.currency,
  );

  const handleDeleteAccount = () => {
    dialogManager.confirm({
      title: "Delete your account?",
      description:
        "All your data will be permanently deleted. This action cannot be undone.",
      variant: "destructive",
      action: {
        label: "Delete my account",
        onClick: async () => {
          const res = await fetch("/api/account/delete", { method: "DELETE" });
          if (!res.ok) {
            toast.error("Failed to delete account. Please try again.");
            return;
          }
          window.location.href = "/";
        },
      },
    });
  };

  // ---------------------------------------------------------------------------
  // PROFILE LAYOUT — reorder rows or move between sections in one line.
  // To reorder: move the line. To change section: edit the section string.
  // Consecutive rows with the same section are grouped into one card.
  // ---------------------------------------------------------------------------
  const subscriptionCard = (
    <div key="subscription" className="nm-raised overflow-hidden rounded-2xl">
      {isActivating && (
        <div className="flex items-center gap-2 border-b border-white/[0.04] px-4 py-2.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
          <p className="text-xs text-amber-400">
            Activating your subscription…
          </p>
        </div>
      )}
      {hasActiveSubscription ? (
        <>
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">
                {activePlan?.tier === "plus" ? "Plus" : "Pro"} Plan
              </p>
              <p className="text-muted-foreground text-[11px]">
                {activePlan?.cancelAtPeriodEnd && activePlan.periodEndDate
                  ? `Ends ${new Date(activePlan.periodEndDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                  : activePlan?.tier === "plus"
                    ? `Up to ${SiteConfig.plusChannelsLimit} channels`
                    : "Unlimited channels and lists"}
              </p>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                activePlan?.cancelAtPeriodEnd
                  ? "bg-amber-600 text-white"
                  : "bg-red-600 text-white"
              }`}
            >
              {activePlan?.cancelAtPeriodEnd ? "Ending" : "Active"}
            </span>
          </div>
          <div className="border-t border-white/[0.04] px-4 py-2.5">
            <button
              onClick={() => {
                void import("@/components/dashboard/cancel-subscription-modal").then(
                  (m) => m.openCancelSubscriptionModal(),
                );
              }}
              className="text-muted-foreground hover:text-destructive text-xs transition-colors"
            >
              {activePlan?.cancelAtPeriodEnd
                ? "Manage subscription →"
                : "Cancel subscription →"}
            </button>
          </div>
        </>
      ) : (
        <div className="px-4 py-3.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                {isTrial ? "Trial" : "Free Plan"}
              </p>
              <p className="text-muted-foreground mt-0.5 text-[11px]">
                {isTrial
                  ? `${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""} left — up to ${SiteConfig.plusChannelsLimit} channels`
                  : `Up to ${SiteConfig.freeChannelsLimit} channels`}
              </p>
            </div>
            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-white/60 uppercase">
              {isTrial ? "Trial" : "Free"}
            </span>
          </div>
          <div className="mt-3 border-t border-white/[0.04] pt-3">
            <p className="text-muted-foreground mb-2 text-[11px]">
              {upgradePlan === "plus"
                ? `${SiteConfig.plusChannelsLimit} channels and priority processing.`
                : "Unlimited channels and priority processing."}
            </p>
          </div>
          {hasPlus && (
            <div className="mt-3 flex items-center gap-2">
              <div className="nm-raised flex rounded-full p-0.5">
                <button
                  onClick={() => setUpgradePlan("plus")}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    upgradePlan === "plus"
                      ? "bg-red-600 text-white"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Plus
                </button>
                <button
                  onClick={() => setUpgradePlan("pro")}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    upgradePlan === "pro"
                      ? "bg-red-600 text-white"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Pro
                </button>
              </div>
            </div>
          )}
          <div className="mt-3 flex items-center gap-2">
            <div className="nm-raised flex rounded-full p-0.5">
              <button
                onClick={() => setUpgradeInterval("month")}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  upgradeInterval === "month"
                    ? "bg-red-600 text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setUpgradeInterval("year")}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  upgradeInterval === "year"
                    ? "bg-red-600 text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Annual
              </button>
            </div>
            {upgradeInterval === "month" ? (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                Save 27%
              </span>
            ) : (
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                You save 27%
              </span>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-sm font-semibold">
              {`${displayUpgradePrice.symbol}${displayUpgradePrice.formatted}/${upgradeInterval === "year" ? "yr" : "mo"}`}
            </p>
            <form
              action="/api/stripe/checkout"
              method="POST"
              data-form-type="other"
              suppressHydrationWarning
            >
              <input type="hidden" name="plan" value={upgradePlan} />
              <input type="hidden" name="interval" value={upgradeInterval} />
              <input type="hidden" name="referral" value={referral} />
              <Button
                type="submit"
                size="sm"
                className="rounded-full bg-red-600 hover:bg-red-500"
              >
                Upgrade
              </Button>
            </form>
          </div>
        </div>
      )}
      {(hasStripeCustomer || hasActiveSubscription) && (
        <div className="border-t border-white/[0.04] px-4 py-2.5">
          <form
            action="/api/stripe/portal"
            method="POST"
            data-form-type="other"
            suppressHydrationWarning
          >
            <button
              type="submit"
              className="text-muted-foreground hover:text-foreground text-xs transition-colors"
            >
              Manage billing & invoices →
            </button>
          </form>
        </div>
      )}
    </div>
  );

  const layout: { section: string; node: React.ReactNode }[] = [
    // Subscription — uses its own card wrapper (no divide-y)
    { section: "Subscription", node: subscriptionCard },
    // Audio & summaries
    {
      section: "Audio & summaries",
      node: (
        <SummaryPreferencesSection
          key="prefs"
          initialLength={initialSummaryLength}
          initialStyle={initialSummaryStyle}
          initialCustomInstructions={initialCustomInstructions}
        />
      ),
    },
    {
      section: "Audio & summaries",
      node: (
        <AudioSettingsSection
          key="audio"
          initialVoice={initialVoice}
          initialLanguage={initialLanguage}
          initialFavorites={initialFavorites}
          initialAudioEnabled={initialAudioEnabled}
        />
      ),
    },
    // Platforms
    {
      section: "Platforms",
      node: (
        <DeliverySection
          key="delivery"
          initialTelegramConnected={initialTelegramConnected}
          initialNotionConnected={initialNotionConnected}
          initialNotionDatabaseName={initialNotionDatabaseName}
          initialWhatsappConnected={initialWhatsappConnected}
          initialWhatsappPhone={initialWhatsappPhone}
          initialDiscordConnected={initialDiscordConnected}
          initialSlackConnected={initialSlackConnected}
        />
      ),
    },
    ...(rssToken
      ? [
          {
            section: "Platforms",
            node: (
              <PodcastFeedSection
                key="podcast"
                rssToken={rssToken}
                audioEnabled={initialAudioEnabled}
              />
            ),
          },
        ]
      : []),
    // Notifications
    {
      section: "Notifications",
      node: (
        <NotificationsSection
          key="notif"
          initialPushEnabled={initialPushEnabled}
          initialNewsletter={initialNewsletter}
          initialAnnouncements={initialAnnouncements}
          initialDailyDigest={initialDailyDigest}
          initialDigestHour={initialDigestHour}
          initialFullSummary={initialFullSummary}
        />
      ),
    },
    // Referral
    {
      section: "Referral",
      node: (
        <ReferralSection
          key="referral"
          referralCode={referralCode ?? ""}
          stats={
            referralStats ?? { total: 0, onTrial: 0, activePro: 0, rewarded: 0 }
          }
        />
      ),
    },
    // Danger zone
    {
      section: "Danger zone",
      node: (
        <div
          key="delete"
          className="flex items-center justify-between px-4 py-3"
        >
          <div>
            <p className="text-sm font-medium">Delete account</p>
            <p className="text-muted-foreground text-[11px]">
              Permanently delete all your data
            </p>
          </div>
          <button
            onClick={handleDeleteAccount}
            className="nm-raised-sm text-muted-foreground hover:text-destructive flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-all"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      ),
    },
    // Admin
    ...(isAdmin
      ? [
          {
            section: "Admin",
            node: (
              <Link
                key="admin"
                href="/dashboard/admin"
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.02]"
              >
                <ShieldAlert className="h-4 w-4 text-red-400" />
                <span className="text-sm font-medium">Admin panel</span>
                <span className="text-muted-foreground ml-auto text-xs">→</span>
              </Link>
            ),
          },
        ]
      : []),
  ];

  // Group consecutive rows with the same section title
  const sections: { title: string; nodes: React.ReactNode[] }[] = [];
  for (const item of layout) {
    const last = sections.at(-1);
    if (last?.title === item.section) {
      last.nodes.push(item.node);
    } else {
      sections.push({ title: item.section, nodes: [item.node] });
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {sections.map(({ title, nodes }) => (
        <section key={title} className="flex flex-col gap-2">
          <h2 className="text-muted-foreground/50 px-1 text-xs font-medium tracking-wide uppercase">
            {title}
          </h2>
          <div className="nm-raised divide-y divide-white/[0.06] overflow-hidden rounded-2xl">
            {nodes}
          </div>
        </section>
      ))}
    </div>
  );
}
