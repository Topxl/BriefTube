"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DeliverySection } from "@/components/dashboard/delivery-section";
import { ReferralSection } from "@/components/dashboard/referral-section";
import { Button } from "@/components/ui/button";
import { LogOut, CheckCircle2 } from "@/lib/icons";

type ReferralRow = {
  maskedEmail: string;
  status: string;
  rewardType: string | null;
  createdAt: string;
  rewardedAt: string | null;
};

type Props = {
  email: string;
  isTrial: boolean;
  isActivePro: boolean;
  trialDaysLeft: number;
  hasStripeCustomer: boolean;
  initialTelegramConnected: boolean;
  initialVoice: string;
  maxChannels: number;
  referralCode?: string;
  referrals?: ReferralRow[];
};

export function ProfileContent({
  email,
  isTrial,
  isActivePro,
  trialDaysLeft,
  hasStripeCustomer,
  initialTelegramConnected,
  initialVoice,
  maxChannels,
  referralCode,
  referrals,
}: Props) {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <div className="space-y-8">
      {/* Account */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Account</h2>
        <div className="overflow-hidden rounded-xl border border-white/[0.06]">
          <div className="divide-y divide-white/[0.04]">
            {/* Email row */}
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-muted-foreground text-[11px]">{email}</p>
              </div>
            </div>

            {/* Plan row */}
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">Plan</p>
                <p className="text-muted-foreground text-[11px]">
                  {isActivePro
                    ? "Pro — unlimited channels and lists"
                    : isTrial
                      ? `Trial — ${trialDaysLeft}d left · ${maxChannels} channels max`
                      : `Free — ${maxChannels} channels max`}
                </p>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${
                  isActivePro
                    ? "bg-red-600 text-white"
                    : isTrial
                      ? "border border-amber-500/30 bg-amber-500/10 text-amber-400"
                      : "text-muted-foreground border border-white/[0.08] bg-white/[0.06]"
                }`}
              >
                {isActivePro ? "Pro" : isTrial ? "Trial" : "Free"}
              </span>
            </div>

            {/* Sign out row */}
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-sm font-medium">Session</p>
              <button
                onClick={() => void handleLogout()}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delivery (Telegram + Voice) */}
      <DeliverySection
        initialTelegramConnected={initialTelegramConnected}
        initialVoice={initialVoice}
      />

      {/* Billing */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Subscription</h2>
        <div className="overflow-hidden rounded-xl border border-white/[0.06]">
          {!isActivePro ? (
            <div className="p-5">
              <p className="text-sm font-medium">
                {isTrial
                  ? `${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""} left on your trial — upgrade now to keep your Pro access`
                  : "Upgrade to Pro"}
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Unlimited channels, follow curated lists, priority processing.
              </p>
              <div className="mt-4 space-y-2">
                {[
                  "Unlimited channels",
                  "Follow community lists",
                  "Priority processing",
                  "Choose your TTS voice",
                ].map((feature) => (
                  <div key={feature} className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    <span className="text-xs">{feature}</span>
                  </div>
                ))}
              </div>
              <form
                action="/api/stripe/checkout"
                method="POST"
                className="mt-4"
                data-form-type="other"
                suppressHydrationWarning
              >
                <Button
                  type="submit"
                  className="w-full bg-red-600 hover:bg-red-500"
                >
                  Upgrade to Pro
                </Button>
              </form>
            </div>
          ) : (
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">Pro Plan</p>
                <p className="text-muted-foreground text-[11px]">
                  Unlimited channels and lists
                </p>
              </div>
              <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white uppercase">
                Active
              </span>
            </div>
          )}

          {hasStripeCustomer && (
            <div className="border-t border-white/[0.04] px-4 py-3">
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
      </div>

      {/* Referral */}
      <ReferralSection
        referralCode={referralCode ?? ""}
        referrals={referrals ?? []}
      />
    </div>
  );
}
