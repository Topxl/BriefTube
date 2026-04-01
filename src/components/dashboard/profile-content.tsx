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

function PodcastFeedSection({ rssToken }: { rssToken: string }) {
  const feedUrl = `${SiteConfig.prodUrl}/api/feed/${rssToken}`;
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-muted-foreground/50 px-1 text-xs font-medium tracking-wide uppercase">
        Podcast feed
      </h2>
      <div className="nm-raised overflow-hidden rounded-2xl">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="nm-inset-sm flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500/[0.12]">
            <Rss className="h-4 w-4 text-orange-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Listen in your podcast app</p>
            <p className="text-muted-foreground mt-0.5 text-[11px]">
              Add your personal feed to any podcast app
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-white/[0.04] px-4 py-3">
          <div className="nm-inset flex items-center gap-2 rounded-xl px-3 py-2">
            <span className="text-muted-foreground min-w-0 flex-1 truncate font-mono text-[11px]">
              {feedUrl}
            </span>
            <button
              onClick={() => void handleCopy()}
              className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
              aria-label="Copy feed URL"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
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
        </div>
      </div>
    </section>
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
import { openCancelSubscriptionModal } from "@/components/dashboard/cancel-subscription-modal";
import { toast } from "sonner";
import { trackAdConversion } from "@/lib/gtag";

type ReferralStats = {
  total: number;
  onTrial: number;
  activePro: number;
  rewarded: number;
};

type Props = {
  avatarUrl: string;
  email: string;
  isTrial: boolean;
  isActivePro: boolean;
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
};

export function ProfileContent({
  avatarUrl: _avatarUrl,
  email: _email,
  isTrial,
  isActivePro,
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
}: Props) {
  const router = useRouter();

  const [retryCount, setRetryCount] = useState(0);
  const [upgradePlan, setUpgradePlan] = useState<Plan>("pro");
  const [upgradeInterval, setUpgradeInterval] = useState<Interval>(
    defaultInterval ?? "year",
  );
  const [prices] = useState<PricesData>(initialPrices);
  const [referral, setReferral] = useState("");

  const isActivating = !!paymentSuccess && !isActivePro && retryCount < 10;

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
    if (isActivePro) {
      trackAdConversion();
      toast.success("You're now Pro!", {
        description: "Enjoy unlimited channels and priority processing.",
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
  }, [paymentSuccess, isActivePro, router, retryCount]);

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

  return (
    <div className="flex flex-col gap-6">
      {/* Subscription */}
      <section className="flex flex-col gap-2">
        <h2 className="text-muted-foreground/50 px-1 text-xs font-medium tracking-wide uppercase">
          Subscription
        </h2>
        <div className="nm-raised overflow-hidden rounded-2xl">
          {isActivating && (
            <div className="flex items-center gap-2 border-b border-white/[0.04] px-4 py-2.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
              <p className="text-xs text-amber-400">
                Activating your subscription…
              </p>
            </div>
          )}
          {isActivePro ? (
            <>
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Pro Plan</p>
                  <p className="text-muted-foreground text-[11px]">
                    Unlimited channels and lists
                  </p>
                </div>
                <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-semibold text-white uppercase">
                  Active
                </span>
              </div>
              <div className="border-t border-white/[0.04] px-4 py-2.5">
                <button
                  onClick={openCancelSubscriptionModal}
                  className="text-muted-foreground hover:text-destructive text-xs transition-colors"
                >
                  Cancel subscription →
                </button>
              </div>
            </>
          ) : (
            <div className="px-4 py-3.5">
              <p className="text-sm font-medium">
                {isTrial
                  ? `${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""} left on your trial`
                  : "Upgrade your plan"}
              </p>
              <p className="text-muted-foreground mt-0.5 text-[11px]">
                {upgradePlan === "plus"
                  ? `${SiteConfig.plusChannelsLimit} channels and priority processing.`
                  : "Unlimited channels and priority processing."}
              </p>

              {/* Plan selector */}
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

              {/* Interval selector */}
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
                  <input
                    type="hidden"
                    name="interval"
                    value={upgradeInterval}
                  />
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
          {(hasStripeCustomer || isActivePro) && (
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
      </section>

      {/* Delivery */}
      <DeliverySection
        initialTelegramConnected={initialTelegramConnected}
        initialNotionConnected={initialNotionConnected}
        initialNotionDatabaseName={initialNotionDatabaseName}
        initialWhatsappConnected={initialWhatsappConnected}
        initialWhatsappPhone={initialWhatsappPhone}
        initialDiscordConnected={initialDiscordConnected}
        initialSlackConnected={initialSlackConnected}
        initialVoice={initialVoice}
        initialLanguage={initialLanguage}
        initialFavorites={initialFavorites}
      />

      {/* Podcast feed */}
      {rssToken && <PodcastFeedSection rssToken={rssToken} />}

      {/* Summary preferences */}
      <SummaryPreferencesSection
        initialLength={initialSummaryLength}
        initialStyle={initialSummaryStyle}
        initialCustomInstructions={initialCustomInstructions}
      />

      {/* Notifications */}
      <NotificationsSection
        initialPushEnabled={initialPushEnabled}
        initialNewsletter={initialNewsletter}
        initialAnnouncements={initialAnnouncements}
        initialDailyDigest={initialDailyDigest}
        initialDigestHour={initialDigestHour}
        initialFullSummary={initialFullSummary}
      />

      {/* Referral */}
      <ReferralSection
        referralCode={referralCode ?? ""}
        stats={
          referralStats ?? { total: 0, onTrial: 0, activePro: 0, rewarded: 0 }
        }
      />

      {/* Danger zone */}
      <section className="flex flex-col gap-2">
        <h2 className="text-muted-foreground/50 px-1 text-xs font-medium tracking-wide uppercase">
          Danger zone
        </h2>
        <div className="nm-raised overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between px-4 py-3">
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
        </div>
      </section>

      {/* Admin */}
      {isAdmin && (
        <section className="flex flex-col gap-2">
          <h2 className="text-muted-foreground/50 px-1 text-xs font-medium tracking-wide uppercase">
            Admin
          </h2>
          <div className="nm-raised overflow-hidden rounded-2xl">
            <Link
              href="/dashboard/admin"
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.02]"
            >
              <ShieldAlert className="h-4 w-4 text-red-400" />
              <span className="text-sm font-medium">Admin panel</span>
              <span className="text-muted-foreground ml-auto text-xs">→</span>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
