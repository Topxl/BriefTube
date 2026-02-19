"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { SiteConfig } from "@/site-config";

type ReferralRow = {
  maskedEmail: string;
  status: string;
  rewardType: string | null;
  createdAt: string;
  rewardedAt: string | null;
};

type Props = {
  referralCode: string;
  referrals: ReferralRow[];
};

export function ReferralSection({ referralCode, referrals }: Props) {
  const [copied, setCopied] = useState(false);

  const referralUrl = `${SiteConfig.prodUrl}/?ref=${referralCode}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalReferred = referrals.length;
  const totalRewarded = referrals.filter((r) => r.status === "rewarded").length;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">Referral</h2>
      <div className="overflow-hidden rounded-xl border border-white/[0.06]">
        {/* Referral link */}
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <p className="text-muted-foreground min-w-0 truncate text-xs">
            {referralUrl}
          </p>
          <button
            onClick={() => void handleCopy()}
            className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
            aria-label="Copy referral link"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {/* Stats */}
        <div className="border-t border-white/[0.04] px-4 py-3">
          <p className="text-muted-foreground text-xs">
            {totalReferred} referred · {totalRewarded} rewarded
          </p>
        </div>

        {/* Reward explanation */}
        <div className="border-t border-white/[0.04] px-4 py-3">
          <p className="text-muted-foreground text-xs">
            Monthly subscriber converts → you earn{" "}
            {Math.round(SiteConfig.referral.monthlyRewardFraction * 100)}%
            credit. Annual subscriber → {SiteConfig.referral.annualRewardMonths}{" "}
            free month
            {SiteConfig.referral.annualRewardMonths > 1 ? "s" : ""} credit.
          </p>
        </div>

        {/* Referral list */}
        {referrals.length > 0 && (
          <div className="border-t border-white/[0.04]">
            <div className="divide-y divide-white/[0.04]">
              {referrals.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-4 py-2.5"
                >
                  <p className="text-xs">{r.maskedEmail}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
                      r.status === "rewarded"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "text-muted-foreground border border-white/[0.08] bg-white/[0.04]"
                    }`}
                  >
                    {r.status === "rewarded" ? "Rewarded" : "Pending"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
