"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DeliverySection } from "@/components/dashboard/delivery-section";
import { ReferralSection } from "@/components/dashboard/referral-section";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { LogOut, Trash2, ShieldAlert, Loader2 } from "@/lib/icons";
import { formatCurrency } from "@/lib/format";
import { logger } from "@/lib/logger";

type Interval = "month" | "year";

type PricesData = {
  monthly: { amount: number; currency: string };
  annual: { amount: number; currency: string };
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
  email: string;
  isTrial: boolean;
  isActivePro: boolean;
  trialDaysLeft: number;
  hasStripeCustomer: boolean;
  initialTelegramConnected: boolean;
  initialVoice: string;
  initialLanguage: string;
  maxChannels: number;
  referralCode?: string;
  referralStats?: ReferralStats;
  isAdmin?: boolean;
  defaultInterval?: Interval;
  paymentSuccess?: boolean;
};

export function ProfileContent({
  email,
  isTrial,
  isActivePro,
  trialDaysLeft,
  hasStripeCustomer,
  initialTelegramConnected,
  initialVoice,
  initialLanguage,
  maxChannels,
  referralCode,
  referralStats,
  isAdmin,
  defaultInterval,
  paymentSuccess,
}: Props) {
  const router = useRouter();

  const [retryCount, setRetryCount] = useState(0);
  const [upgradeInterval, setUpgradeInterval] = useState<Interval>(
    defaultInterval ?? "year",
  );
  const [prices, setPrices] = useState<PricesData | null>(null);

  const isActivating = !!paymentSuccess && !isActivePro && retryCount < 10;

  useEffect(() => {
    fetch("/api/stripe/price")
      .then(async (res) => res.json())
      .then((data: PricesData) => {
        if (data.monthly.amount) setPrices(data);
      })
      .catch((err) => logger.error("Failed to fetch price:", err));
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

  const priceData = prices
    ? upgradeInterval === "year"
      ? prices.annual
      : prices.monthly
    : null;

  const displayUpgradePrice = priceData
    ? formatCurrency(priceData.amount, priceData.currency)
    : null;

  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

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
    <div className="space-y-6">
      {/* Account */}
      <section className="space-y-2">
        <h2 className="text-muted-foreground/50 px-1 text-xs font-medium tracking-wide uppercase">
          Account
        </h2>
        <div className="nm-raised overflow-hidden rounded-2xl">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="nm-inset-sm flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/[0.12] text-sm font-bold text-red-400">
              {email.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{email}</p>
              <p className="text-muted-foreground mt-0.5 text-[11px]">
                {isActivePro
                  ? "Pro — unlimited channels"
                  : isTrial
                    ? `Trial · ${trialDaysLeft}d left · ${maxChannels} channels max`
                    : `Free · ${maxChannels} channels max`}
              </p>
            </div>
            <span
              className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
                isActivePro
                  ? "bg-red-600 text-white"
                  : isTrial
                    ? "nm-inset-sm text-amber-400"
                    : "nm-raised-sm text-muted-foreground"
              }`}
            >
              {isActivePro ? "Pro" : isTrial ? "Trial" : "Free"}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-white/[0.04] px-4 py-2.5">
            <button
              onClick={handleDeleteAccount}
              className="nm-raised-sm text-muted-foreground hover:text-destructive flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-all"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete account
            </button>
            <button
              onClick={() => void handleLogout()}
              className="nm-raised-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-all"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </section>

      {/* Delivery */}
      <DeliverySection
        initialTelegramConnected={initialTelegramConnected}
        initialVoice={initialVoice}
        initialLanguage={initialLanguage}
      />

      {/* Subscription */}
      <section className="space-y-2">
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
                  : "Upgrade to Pro"}
              </p>
              <p className="text-muted-foreground mt-0.5 text-[11px]">
                Unlimited channels and priority processing.
              </p>
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
                  <button
                    onClick={() => setUpgradeInterval("year")}
                    className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400 transition-colors hover:bg-amber-500/20"
                  >
                    Save 27%
                  </button>
                ) : (
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                    You save 27%
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-sm font-semibold">
                  {displayUpgradePrice
                    ? `${displayUpgradePrice.symbol}${displayUpgradePrice.formatted}/${upgradeInterval === "year" ? "yr" : "mo"}`
                    : "—"}
                </p>
                <form
                  action="/api/stripe/checkout"
                  method="POST"
                  data-form-type="other"
                  suppressHydrationWarning
                >
                  <input
                    type="hidden"
                    name="interval"
                    value={upgradeInterval}
                  />
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

      {/* Referral */}
      <ReferralSection
        referralCode={referralCode ?? ""}
        stats={
          referralStats ?? { total: 0, onTrial: 0, activePro: 0, rewarded: 0 }
        }
      />

      {/* Admin */}
      {isAdmin && (
        <section className="space-y-2">
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
