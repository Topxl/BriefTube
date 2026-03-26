"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { formatCurrency } from "@/lib/format";
import { usePrices } from "@/hooks/use-prices";
import { t } from "@/locales";

const tl = t.landing.pricing;

type Interval = "month" | "year";

const plans = [
  {
    key: "free" as const,
    isPro: false,
    isPlus: false,
    highlighted: false,
    href: "/login",
  },
  {
    key: "plus" as const,
    isPro: false,
    isPlus: true,
    highlighted: false,
    href: "/login",
  },
  {
    key: "pro" as const,
    isPro: true,
    isPlus: false,
    highlighted: true,
    href: "/login",
  },
];

export function Pricing() {
  const { data: prices } = usePrices();
  const [interval, setInterval] = useState<Interval>("month");

  const priceData = prices?.monthly.amount
    ? interval === "year"
      ? prices.annual
      : prices.monthly
    : null;

  const plusPriceData = prices?.plus
    ? interval === "year"
      ? prices.plus.annual
      : prices.plus.monthly
    : null;

  return (
    <section id="pricing" className="py-14 md:py-20">
      <div className="mx-auto max-w-4xl px-6">
        <ScrollReveal>
          <h2 className="font-display text-center text-2xl font-bold md:text-3xl">
            {tl.heading}
          </h2>
          <p className="text-muted-foreground mt-3 text-center">
            {tl.subtitle}
          </p>
        </ScrollReveal>

        {/* Billing toggle */}
        <ScrollReveal delay={100}>
          <div className="mt-8 flex items-center justify-center gap-3">
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
        </ScrollReveal>

        <ScrollReveal delay={150}>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {plans.map((plan) => {
              const planData = tl.plans[plan.key];

              const activePriceData = plan.isPlus
                ? (plusPriceData ?? priceData)
                : priceData;

              const displayPrice =
                (plan.isPro || plan.isPlus) && activePriceData
                  ? formatCurrency(
                      activePriceData.amount,
                      activePriceData.currency,
                    )
                  : { formatted: "0", symbol: "$" };

              return (
                <div
                  key={plan.key}
                  className={`nm-raised relative rounded-2xl transition-all duration-300 hover:-translate-y-1 ${
                    plan.highlighted ? "border border-red-500/[0.15]" : ""
                  }`}
                >
                  {plan.highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="nm-raised-sm inline-flex items-center rounded-full bg-red-600 px-3 py-0.5 text-xs font-medium text-white shadow-[0_0_12px_rgba(239,68,68,0.3)]">
                        {tl.mostPopular}
                      </span>
                    </div>
                  )}
                  <div
                    className={`border-b border-white/[0.04] px-5 pb-5 ${plan.highlighted ? "pt-7" : "pt-5"}`}
                  >
                    <p className="text-sm font-semibold tracking-wide uppercase">
                      {planData.name}
                    </p>
                    <div className="mt-3 flex items-baseline gap-1">
                      {plan.isPro || plan.isPlus ? (
                        <>
                          <span className="text-4xl font-bold">
                            {displayPrice.symbol}
                            {displayPrice.formatted}
                          </span>
                          <span className="text-muted-foreground">
                            /{interval === "year" ? "year" : "month"}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-4xl font-bold">$0</span>
                          <span className="text-muted-foreground">/month</span>
                        </>
                      )}
                    </div>
                    {(plan.isPro || plan.isPlus) && interval === "year" && (
                      <p className="text-muted-foreground mt-1 text-xs">
                        Billed annually, equivalent to $
                        {activePriceData
                          ? Math.round(activePriceData.amount / 12 / 100)
                          : "7"}
                        /month
                      </p>
                    )}
                    <p className="text-muted-foreground mt-1 text-sm">
                      {planData.description}
                    </p>
                  </div>
                  <div className="px-5 py-4">
                    <ul className="mb-6 space-y-3">
                      {planData.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-center gap-2 text-sm"
                        >
                          <svg
                            className="h-4 w-4 shrink-0 text-emerald-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M4.5 12.75l6 6 9-13.5"
                            />
                          </svg>
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button
                      className={`w-full rounded-full ${
                        plan.highlighted
                          ? "bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.25)] hover:bg-red-500"
                          : ""
                      }`}
                      variant={plan.highlighted ? "destructive" : "outline"}
                      asChild
                    >
                      <Link href={plan.href}>{planData.cta}</Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
