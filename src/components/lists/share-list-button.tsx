"use client";

import { useState } from "react";
import { Share2, Check } from "@/lib/icons";
import { SiteConfig } from "@/site-config";

type Props = {
  listId: string;
  referralCode: string | null;
};

export function ShareListButton({ listId, referralCode }: Props) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url =
      `${SiteConfig.prodUrl}/lists/${listId}${ 
      referralCode ? `?ref=${referralCode}` : ""}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={() => void handleShare()}
      className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs transition-colors"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-400" />
          Copied!
        </>
      ) : (
        <>
          <Share2 className="h-3.5 w-3.5" />
          Share
        </>
      )}
    </button>
  );
}
