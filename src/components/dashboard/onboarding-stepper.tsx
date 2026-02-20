"use client";

import Link from "next/link";
import { Check } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { t } from "@/locales";

const tl = t.dashboard.stepper;

type OnboardingStepperProps = {
  telegramConnected: boolean;
  channelCount: number;
  deliveryCount: number;
};

const steps = [
  {
    title: tl.step1Title,
    description: tl.step1Desc,
    cta: tl.step1Cta,
    href: "/dashboard/settings",
  },
  {
    title: tl.step2Title,
    description: tl.step2Desc,
    cta: tl.step2Cta,
    href: "/dashboard/channels",
  },
  {
    title: tl.step3Title,
    description: tl.step3Desc,
    cta: tl.step3Cta,
    href: "/dashboard#summaries",
  },
];

export function OnboardingStepper({
  telegramConnected,
  channelCount,
  deliveryCount,
}: OnboardingStepperProps) {
  const completed = [telegramConnected, channelCount > 0, deliveryCount > 0];
  const completedCount = completed.filter(Boolean).length;
  const allDone = completedCount === 3;

  if (allDone) return null;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-muted-foreground text-xs font-medium">
          {tl.progressLabel(completedCount)}
        </p>
        <div className="h-1 w-20 rounded-full bg-white/[0.06] sm:w-24">
          <div
            className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-500 transition-all duration-500"
            style={{ width: `${(completedCount / 3) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        {steps.map((step, i) => {
          const done = completed[i];
          return (
            <div
              key={step.title}
              className={`flex-1 rounded-lg border p-3 transition-colors ${
                done
                  ? "border-emerald-500/15 bg-emerald-500/[0.04]"
                  : "border-white/[0.06] bg-white/[0.02]"
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${
                    done
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "text-muted-foreground bg-white/[0.06]"
                  }`}
                >
                  {done ? <Check className="h-3 w-3" /> : i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-xs leading-tight font-medium ${done ? "text-emerald-400" : ""}`}
                  >
                    {step.title}
                  </p>
                  <p className="text-muted-foreground text-[11px] leading-snug">
                    {step.description}
                  </p>
                </div>
                {!done && (
                  <Button
                    size="xs"
                    variant="outline"
                    className="h-6 shrink-0 text-[11px] sm:hidden"
                    asChild
                  >
                    <Link href={step.href}>{step.cta}</Link>
                  </Button>
                )}
              </div>
              {!done && (
                <Button
                  size="xs"
                  variant="outline"
                  className="mt-2 hidden h-6 text-[11px] sm:inline-flex"
                  asChild
                >
                  <Link href={step.href}>{step.cta}</Link>
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
