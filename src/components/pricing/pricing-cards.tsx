"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "@/lib/icons";
import { formatCurrency } from "@/lib/format";
import { logger } from "@/lib/logger";

type Interval = "month" | "year";

type PricesData = {
  monthly: { amount: number; currency: string };
  annual: { amount: number; currency: string };
};

type Props = {
  isLoggedIn: boolean;
  isPro: boolean;
};

const FREE_FEATURES = [
  "5 YouTube channels",
  "AI audio summaries",
  "Telegram delivery",
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

  useEffect(() => {
    fetch("/api/stripe/price")
      .then(async (res) => res.json())
      .then((data: PricesData) => {
        if (data.monthly.amount) setPrices(data);
      })
      .catch((err) => logger.error("Failed to fetch price:", err));
  }, []);

  const priceData = prices
    ? interval === "year"
      ? prices.annual
      : prices.monthly
    : null;

  const displayPrice = priceData
    ? formatCurrency(priceData.amount, priceData.currency)
    : null;

  const annualMonthlyEquiv =
    prices && interval === "year"
      ? Math.round(prices.annual.amount / 12 / 100)
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

      <div className="grid gap-4 md:grid-cols-2">
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
              {displayPrice ? (
                <>
                  <span className="text-4xl font-bold">
                    {displayPrice.symbol}
                    {displayPrice.formatted}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    /{interval === "year" ? "year" : "month"}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground text-sm">Loading…</span>
              )}
            </div>
            {annualMonthlyEquiv !== null && (
              <p className="text-muted-foreground mt-1 text-xs">
                Billed annually — equivalent to ${annualMonthlyEquiv}/month
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
