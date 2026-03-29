"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "@/lib/icons";
import { formatCurrency } from "@/lib/format";
import { logger } from "@/lib/logger";
import { SiteConfig } from "@/site-config";

type Interval = "month" | "year";

type PriceInfo = {
  amount: number;
  currency: string;
};

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

type Props = {
  isLoggedIn: boolean;
  isPro: boolean;
};

const FREE_FEATURES = [
  `${SiteConfig.freeChannelsLimit} YouTube channels`,
  "AI audio summaries",
  "Telegram, Discord & Slack",
];

const PLUS_FEATURES = [
  `${SiteConfig.plusChannelsLimit} YouTube channels`,
  "AI audio summaries",
  "Telegram, Discord & Slack",
  "Priority processing",
];

const PRO_FEATURES = [
  "Unlimited channels",
  "Priority processing",
  "Choose your TTS voice",
  "No branding",
  "Early access to features",
];

export function PricingCards({ isLoggedIn, isPro }: Props) {
  const [interval, setInterval] = useState<Interval>("year");
  const [prices, setPrices] = useState<PricesData | null>(null);
  const [referral, setReferral] = useState("");

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
    fetch("/api/stripe/price")
      .then(async (res) => res.json())
      .then((data: PricesData) => {
        if (data.monthly.amount) setPrices(data);
      })
      .catch((err) => logger.error("Failed to fetch price:", err));
  }, []);

  const proPriceData = prices?.pro
    ? interval === "year"
      ? prices.pro.annual
      : prices.pro.monthly
    : prices
      ? interval === "year"
        ? prices.annual
        : prices.monthly
      : null;

  const plusPriceData = prices?.plus
    ? interval === "year"
      ? prices.plus.annual
      : prices.plus.monthly
    : null;

  const displayProPrice = proPriceData
    ? formatCurrency(proPriceData.amount, proPriceData.currency)
    : null;

  const displayPlusPrice = plusPriceData
    ? formatCurrency(plusPriceData.amount, plusPriceData.currency)
    : null;

  const proAnnualMonthlyEquiv =
    proPriceData && interval === "year"
      ? Math.round(proPriceData.amount / 12 / 100)
      : null;

  const plusAnnualMonthlyEquiv =
    plusPriceData && interval === "year"
      ? Math.round(plusPriceData.amount / 12 / 100)
      : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3">
        <div className="nm-raised flex rounded-full p-1">
          <button
            onClick={() => setInterval("month")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              interval === "month"
                ? "bg-red-600 text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setInterval("year")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              interval === "year"
                ? "bg-red-600 text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Annual
          </button>
        </div>
        {interval === "month" ? (
          <button
            onClick={() => setInterval("year")}
            className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400 transition-colors hover:bg-amber-500/20"
          >
            Save 27% with Annual
          </button>
        ) : (
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
            You save 27%
          </span>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Free Plan */}
        <div className="nm-raised overflow-hidden rounded-2xl">
          <div className="border-b border-white/[0.04] px-5 py-5">
            <p className="text-sm font-semibold tracking-wide uppercase">
              Free
            </p>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl font-bold">$0</span>
              <span className="text-muted-foreground text-sm">/month</span>
            </div>
          </div>
          <div className="px-5 py-4">
            <ul className="space-y-2.5">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  {f}
                </li>
              ))}
            </ul>
            {isLoggedIn && !isPro && (
              <Button
                disabled
                className="mt-5 w-full rounded-full"
                variant="outline"
              >
                Current Plan
              </Button>
            )}
            {!isLoggedIn && (
              <Button asChild className="mt-5 w-full rounded-full">
                <a href="/login">Start free trial</a>
              </Button>
            )}
          </div>
        </div>

        {/* Plus Plan */}
        <div className="nm-raised overflow-hidden rounded-2xl">
          <div className="border-b border-white/[0.04] px-5 py-5">
            <p className="text-sm font-semibold tracking-wide uppercase">
              Plus
            </p>
            <div className="mt-3 flex items-baseline gap-1">
              {displayPlusPrice ? (
                <>
                  <span className="text-4xl font-bold">
                    {displayPlusPrice.symbol}
                    {displayPlusPrice.formatted}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    /{interval === "year" ? "year" : "month"}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground text-sm">Loading…</span>
              )}
            </div>
            {plusAnnualMonthlyEquiv !== null && (
              <p className="text-muted-foreground mt-1 text-xs">
                Billed annually — equivalent to ${plusAnnualMonthlyEquiv}/month
              </p>
            )}
          </div>
          <div className="px-5 py-4">
            <ul className="space-y-2.5">
              {PLUS_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  {f}
                </li>
              ))}
            </ul>
            {isLoggedIn ? (
              <form
                action="/api/stripe/checkout"
                method="POST"
                data-form-type="other"
                suppressHydrationWarning
              >
                <input type="hidden" name="interval" value={interval} />
                <input type="hidden" name="plan" value="plus" />
                <input type="hidden" name="referral" value={referral} />
                <Button
                  type="submit"
                  className="mt-5 w-full rounded-full"
                  variant="outline"
                >
                  Go Plus
                </Button>
              </form>
            ) : (
              <Button
                asChild
                className="mt-5 w-full rounded-full"
                variant="outline"
              >
                <a href="/login">Start Plus Trial</a>
              </Button>
            )}
          </div>
        </div>

        {/* Pro Plan */}
        <div className="nm-raised relative overflow-hidden rounded-2xl border border-red-500/[0.12]">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="nm-raised-sm inline-flex items-center rounded-full bg-red-600 px-3 py-0.5 text-xs font-medium text-white shadow-[0_0_12px_rgba(239,68,68,0.3)]">
              Most popular
            </span>
          </div>
          <div className="border-b border-white/[0.04] px-5 pt-7 pb-5">
            <p className="text-sm font-semibold tracking-wide uppercase">Pro</p>
            <div className="mt-3 flex items-baseline gap-1">
              {displayProPrice ? (
                <>
                  <span className="text-4xl font-bold">
                    {displayProPrice.symbol}
                    {displayProPrice.formatted}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    /{interval === "year" ? "year" : "month"}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground text-sm">Loading…</span>
              )}
            </div>
            {proAnnualMonthlyEquiv !== null && (
              <p className="text-muted-foreground mt-1 text-xs">
                Billed annually — equivalent to ${proAnnualMonthlyEquiv}/month
              </p>
            )}
          </div>
          <div className="px-5 py-4">
            <ul className="space-y-2.5">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  {f}
                </li>
              ))}
            </ul>
            {isPro ? (
              <Button
                disabled
                className="mt-5 w-full rounded-full"
                variant="outline"
              >
                Current Plan
              </Button>
            ) : isLoggedIn ? (
              <form
                action="/api/stripe/checkout"
                method="POST"
                data-form-type="other"
                suppressHydrationWarning
              >
                <input type="hidden" name="interval" value={interval} />
                <input type="hidden" name="referral" value={referral} />
                <Button
                  type="submit"
                  className="mt-5 w-full rounded-full bg-red-600 hover:bg-red-500"
                >
                  Upgrade to Pro
                </Button>
              </form>
            ) : (
              <Button
                asChild
                className="mt-5 w-full rounded-full bg-red-600 hover:bg-red-500"
              >
                <a href="/login">Start Pro Trial</a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
