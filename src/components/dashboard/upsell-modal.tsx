"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "@/lib/icons";
import { dialogManager } from "@/features/dialog-manager/dialog-manager";
import { formatCurrency } from "@/lib/format";
import { logger } from "@/lib/logger";

type Interval = "month" | "year";

type PricesData = {
  monthly: { amount: number; currency: string };
  annual: { amount: number; currency: string };
};

const PRO_FEATURES = [
  "Unlimited active channels",
  "Priority processing",
  "Choose your TTS voice",
  "No branding in audio",
];

type Props = {
  defaultInterval?: Interval;
};

export function UpsellModal({ defaultInterval = "year" }: Props) {
  const [interval, setInterval] = useState<Interval>(defaultInterval);
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

  const monthlyEquiv =
    prices && interval === "year"
      ? Math.round(prices.annual.amount / 12 / 100)
      : null;

  return (
    <div className="flex flex-col gap-4">
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

      {/* Price */}
      <div className="nm-raised rounded-2xl px-5 py-4">
        <div className="flex items-baseline gap-1">
          {displayPrice ? (
            <>
              <span className="text-3xl font-bold">
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
        {monthlyEquiv !== null && (
          <p className="text-muted-foreground mt-0.5 text-xs">
            Billed annually — equivalent to ${monthlyEquiv}/month
          </p>
        )}

        {/* Features */}
        <ul className="mt-4 space-y-2">
          {PRO_FEATURES.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* Checkout form */}
      <form
        action="/api/stripe/checkout"
        method="POST"
        data-form-type="other"
        suppressHydrationWarning
      >
        <input type="hidden" name="interval" value={interval} />
        <Button
          type="submit"
          className="w-full rounded-full bg-red-600 hover:bg-red-500"
        >
          Upgrade to Pro
        </Button>
      </form>
    </div>
  );
}

export function openUpsellModal(defaultInterval: Interval = "year") {
  dialogManager.custom({
    title: "Upgrade to Pro",
    size: "sm",
    children: <UpsellModal defaultInterval={defaultInterval} />,
  });
}
