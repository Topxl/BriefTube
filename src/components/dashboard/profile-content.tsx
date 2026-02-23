"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DeliverySection } from "@/components/dashboard/delivery-section";
import { ReferralSection } from "@/components/dashboard/referral-section";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { LogOut, Trash2, ShieldAlert } from "@/lib/icons";

import { dialogManager } from "@/features/dialog-manager/dialog-manager";
import { toast } from "sonner";

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
  initialLanguage: string;
  maxChannels: number;
  referralCode?: string;
  referrals?: ReferralRow[];
  isAdmin?: boolean;
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
  referrals,
  isAdmin,
}: Props) {
  const router = useRouter();
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
          {isActivePro ? (
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
          ) : (
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {isTrial
                    ? `${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""} left on your trial`
                    : "Upgrade to Pro"}
                </p>
                <p className="text-muted-foreground mt-0.5 text-[11px]">
                  Unlimited channels, lists, and priority processing.
                </p>
              </div>
              <form
                action="/api/stripe/checkout"
                method="POST"
                data-form-type="other"
                suppressHydrationWarning
                className="shrink-0"
              >
                <Button
                  type="submit"
                  size="sm"
                  className="rounded-full bg-red-600 hover:bg-red-500"
                >
                  Upgrade
                </Button>
              </form>
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
        referrals={referrals ?? []}
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
