"use client";

import { useState } from "react";
import { Copy, Check, Share2, ChevronDown } from "@/lib/icons";
import { SiteConfig } from "@/site-config";

const shareText = `I use BriefTube to get AI audio summaries of YouTube videos delivered to my Telegram — try it:`;

type ReferralStats = {
  total: number;
  onTrial: number;
  activePro: number;
  rewarded: number;
};

type Props = {
  referralCode: string;
  stats: ReferralStats;
};

export function ReferralSection({ referralCode, stats }: Props) {
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const referralUrl = `${SiteConfig.prodUrl}/r/${referralCode}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if ("share" in navigator) {
      void navigator.share({
        title: SiteConfig.title,
        text: shareText,
        url: referralUrl,
      });
    } else {
      void handleCopy();
    }
  };

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-muted-foreground/50 px-1 text-xs font-medium tracking-wide uppercase">
        Referral
      </h2>
      <div className="nm-raised divide-y divide-white/[0.06] overflow-hidden rounded-2xl">
        {/* Main row — share */}
        <div className="flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="nm-inset-sm flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
              <Share2 className="text-muted-foreground h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium">Refer a friend</p>
              <p className="text-muted-foreground text-[11px]">
                {stats.total > 0
                  ? `${stats.total} referred · ${stats.activePro} converted`
                  : "Earn credits when friends subscribe"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void handleCopy()}
              className="nm-raised-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-all"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-green-400" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  Copy
                </>
              )}
            </button>
            <button
              onClick={handleShare}
              className="nm-raised-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-all"
            >
              <Share2 className="h-3 w-3" />
              Share
            </button>
          </div>
        </div>

        {/* Details toggle */}
        <div>
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
          >
            <p className="text-muted-foreground text-xs">Referral details</p>
            <ChevronDown
              className={`text-muted-foreground/50 h-3.5 w-3.5 transition-transform ${showDetails ? "rotate-180" : ""}`}
            />
          </button>
          {showDetails && (
            <div className="border-t border-white/[0.04] px-4 py-3">
              {/* Stats */}
              <div className="grid grid-cols-4 gap-3">
                <div className="text-center">
                  <p className="text-foreground text-sm font-semibold">
                    {stats.total}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-[10px]">
                    Referred
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-amber-400">
                    {stats.onTrial}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-[10px]">
                    Trial
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-emerald-400">
                    {stats.activePro}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-[10px]">
                    Pro
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-sky-400">
                    {stats.rewarded}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-[10px]">
                    Rewarded
                  </p>
                </div>
              </div>
              {/* Reward explanation */}
              <p className="text-muted-foreground/60 mt-3 text-[11px]">
                Monthly subscriber converts → you earn{" "}
                {Math.round(SiteConfig.referral.monthlyRewardFraction * 100)}%
                credit. Annual subscriber →{" "}
                {SiteConfig.referral.annualRewardMonths} free month
                {SiteConfig.referral.annualRewardMonths > 1 ? "s" : ""} credit.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
