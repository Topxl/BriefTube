"use client";

import { useState } from "react";
import { Copy, Check, Share2 } from "@/lib/icons";
import { SiteConfig } from "@/site-config";
import QRCode from "react-qr-code";

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
  const [showQr, setShowQr] = useState(false);

  const referralUrl = `${SiteConfig.prodUrl}/r/${referralCode}`;
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(referralUrl)}`;
  const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(referralUrl)}&text=${encodeURIComponent(shareText)}`;
  const storyImageUrl = `/api/og/story/${referralCode}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = () => {
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
    <section className="space-y-2">
      <h2 className="text-muted-foreground/50 px-1 text-xs font-medium tracking-wide uppercase">
        Referral
      </h2>
      <div className="nm-raised overflow-hidden rounded-2xl">
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
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleNativeShare}
              className="nm-raised-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all"
            >
              <Share2 className="h-3 w-3" />
              Share
            </button>
            <a
              href={tweetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="nm-raised-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all"
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
              className="nm-raised-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all"
              aria-label="Share on Telegram"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
              Telegram
            </a>
            <a
              href={storyImageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="nm-raised-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all"
              aria-label="View Instagram Story"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
              </svg>
              Story
            </a>
            <button
              onClick={() => setShowQr((v) => !v)}
              className={`nm-raised-sm flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all ${showQr ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 3h7v7H3V3zm1 1v5h5V4H4zm1 1h3v3H5V5zm8-2h7v7h-7V3zm1 1v5h5V4h-5zm1 1h3v3h-3V5zM3 13h7v7H3v-7zm1 1v5h5v-5H4zm1 1h3v3H5v-3zm10 0h2v2h-2v-2zm0 4h2v2h-2v-2zm-2-4h2v2h-2v-2zm4-2h2v2h-2v-2zm-2 0h2v2h-2v-2zm4 4h2v2h-2v-2zm-2 2h2v2h-2v-2z" />
              </svg>
              QR
            </button>
          </div>
        </div>

        {/* QR code — visible on demand */}
        {showQr && (
          <div className="flex justify-center border-t border-white/[0.04] px-4 py-5">
            <div className="rounded-xl bg-white p-3">
              <QRCode value={referralUrl} size={160} />
            </div>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-4 divide-x divide-white/[0.04] border-t border-white/[0.04]">
          <div className="px-4 py-3 text-center">
            <p className="text-foreground text-sm font-semibold">
              {stats.total}
            </p>
            <p className="text-muted-foreground mt-0.5 text-[10px]">Referred</p>
          </div>
          <div className="px-4 py-3 text-center">
            <p className="text-sm font-semibold text-amber-400">
              {stats.onTrial}
            </p>
            <p className="text-muted-foreground mt-0.5 text-[10px]">Trial</p>
          </div>
          <div className="px-4 py-3 text-center">
            <p className="text-sm font-semibold text-emerald-400">
              {stats.activePro}
            </p>
            <p className="text-muted-foreground mt-0.5 text-[10px]">Pro</p>
          </div>
          <div className="px-4 py-3 text-center">
            <p className="text-sm font-semibold text-sky-400">
              {stats.rewarded}
            </p>
            <p className="text-muted-foreground mt-0.5 text-[10px]">Rewarded</p>
          </div>
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
      </div>
    </section>
  );
}
