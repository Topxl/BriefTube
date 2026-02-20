"use client";

import { useState } from "react";
import { Copy, Check } from "@/lib/icons";
import { SiteConfig } from "@/site-config";

const shareText = `I use BriefTube to get AI audio summaries of YouTube videos delivered to my Telegram — try it:`;

function ShareButtons({ url }: { url: string }) {
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`;
  const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`;
  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  const handleNativeShare = () => {
    void navigator.share({ title: SiteConfig.title, text: shareText, url });
  };

  return (
    <div className="flex items-center gap-2">
      {canNativeShare && (
        <button
          onClick={handleNativeShare}
          className="text-muted-foreground hover:text-foreground rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-xs transition-colors"
        >
          Share
        </button>
      )}
      <a
        href={tweetUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-xs transition-colors"
        aria-label="Share on X"
      >
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.91-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        X
      </a>
      <a
        href={tgUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-xs transition-colors"
        aria-label="Share on Telegram"
      >
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
        Telegram
      </a>
    </div>
  );
}

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
    <section className="space-y-2">
      <h2 className="text-muted-foreground/50 px-1 text-xs font-medium tracking-wide uppercase">
        Referral
      </h2>
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

        {/* Share buttons */}
        <div className="border-t border-white/[0.04] px-4 py-3">
          <ShareButtons url={referralUrl} />
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
    </section>
  );
}
