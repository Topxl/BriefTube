"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "@/lib/icons";
import { dialogManager } from "@/features/dialog-manager/dialog-manager";
import { formatCurrency } from "@/lib/format";
import { capture } from "@/lib/posthog/client";
import { SiteConfig } from "@/site-config";
import { usePrices } from "@/hooks/use-prices";

type Interval = "month" | "year";
type Plan = "plus" | "pro";

const PLUS_FEATURES = [
  `${SiteConfig.plusChannelsLimit} active channels`,
  "Priority processing",
  "AI audio summaries",
];

const PRO_FEATURES = [
  "Unlimited active channels",
  "Priority processing",
  "Choose your TTS voice",
  "No branding in audio",
  "Early access to new features",
];

type Props = {
  defaultInterval?: Interval;
  defaultPlan?: Plan;
};

export function UpsellModal({
  defaultInterval = "year",
  defaultPlan = "plus",
}: Props) {
  const { data: prices } = usePrices();
  const [plan, setPlan] = useState<Plan>(defaultPlan);
  const [interval, setInterval] = useState<Interval>(defaultInterval);
  const [referral, setReferral] = useState("");

  useEffect(() => {
    capture("upsell_shown", { source: "channel_limit" });
  }, []);

  useEffect(() => {
    if (prices && !prices.plus) setPlan("pro");
  }, [prices]);

  useEffect(() => {
    const w = window as Window & {
      rewardful?: (event: string, cb: () => void) => void;
      Rewardful?: { referral: string };
    };
    w.rewardful?.("ready", () => {
      if (w.Rewardful?.referral) setReferral(w.Rewardful.referral);
    });
  }, []);

  const hasPlus = !!prices?.plus;
  const features = plan === "plus" ? PLUS_FEATURES : PRO_FEATURES;

  const priceData =
    plan === "plus" && prices?.plus
      ? interval === "year"
        ? prices.plus.annual
        : prices.plus.monthly
      : prices?.pro
        ? interval === "year"
          ? prices.pro.annual
          : prices.pro.monthly
        : null;

  const displayPrice = priceData
    ? formatCurrency(priceData.amount, priceData.currency)
    : null;

  const monthlyEquiv =
    priceData && interval === "year"
      ? Math.round(priceData.amount / 12 / 100)
      : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Plan selector */}
      {hasPlus && (
        <div className="flex items-center justify-center">
          <div className="nm-raised flex rounded-full p-1">
            <button
              onClick={() => setPlan("plus")}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                plan === "plus"
                  ? "bg-red-600 text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Plus
            </button>
            <button
              onClick={() => setPlan("pro")}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                plan === "pro"
                  ? "bg-red-600 text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Pro
            </button>
          </div>
        </div>
      )}

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
          {features.map((f) => (
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
        onSubmit={() => {
          capture("upsell_clicked", { plan });
        }}
      >
        <input type="hidden" name="plan" value={plan} />
        <input type="hidden" name="interval" value={interval} />
        <input type="hidden" name="referral" value={referral} />
        <Button
          type="submit"
          className="w-full rounded-full bg-red-600 hover:bg-red-500"
        >
          Upgrade to {plan === "plus" ? "Plus" : "Pro"}
        </Button>
      </form>
    </div>
  );
}

export function openUpsellModal(
  defaultInterval: Interval = "month",
  defaultPlan: Plan = "plus",
) {
  dialogManager.custom({
    title: "Upgrade your plan",
    size: "sm",
    children: (
      <UpsellModal
        defaultInterval={defaultInterval}
        defaultPlan={defaultPlan}
      />
    ),
  });
}
