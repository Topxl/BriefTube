"use client";

import { useState } from "react";
import { Play, Plus, Loader2 } from "@/lib/icons";
import { toast } from "sonner";

type Props = {
  videoId: string;
  channelId: string;
  title: string;
  publishedAt: string;
  onSummarized?: () => void;
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  if (diffH < 1) return "Just now";
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "Yesterday";
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString();
}

export function VideoInboxRow({
  videoId,
  channelId,
  title,
  publishedAt,
  onSummarized,
}: Props) {
  const [summarizing, setSummarizing] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const thumbnailUrl = `/api/thumbnail/${videoId}`;

  const handleSummarize = async () => {
    setSummarizing(true);
    try {
      const res = await fetch("/api/process-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, videoTitle: title }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        toast.error(err.error ?? "Failed to start summary");
        return;
      }
      toast.success("Summary requested — it will appear in your feed shortly");
      onSummarized?.();
    } catch {
      toast.error("Failed to request summary");
    } finally {
      setSummarizing(false);
    }
  };

  const handleSubscribe = async () => {
    setSubscribing(true);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        toast.error(err.error ?? "Failed to subscribe");
        return;
      }
      toast.success("Subscribed — new videos will be summarized automatically");
    } catch {
      toast.error("Failed to subscribe");
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <div className="nm-raised overflow-hidden rounded-2xl opacity-80 transition-all duration-200 hover:opacity-100">
      <div className="flex items-center gap-3 p-3">
        {/* Thumbnail */}
        <div className="relative h-[64px] w-[114px] shrink-0 overflow-hidden rounded-lg bg-black/30 sm:h-[72px] sm:w-[128px]">
          <div
            className="h-full w-full bg-cover bg-center opacity-70"
            style={{ backgroundImage: `url(${thumbnailUrl})` }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.1] bg-black/50">
              <Play className="ml-px h-4 w-4 text-white/50" />
            </div>
          </div>
        </div>

        {/* Title + date */}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm leading-snug font-medium">
            {title}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {formatDate(publishedAt)}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 border-t border-white/[0.04] px-3 py-2">
        <button
          onClick={() => void handleSummarize()}
          disabled={summarizing}
          className="nm-raised-sm flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-red-400 transition-all hover:text-red-300 disabled:opacity-50"
        >
          {summarizing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Play className="h-3 w-3" />
          )}
          Summarize
        </button>
        <button
          onClick={() => void handleSubscribe()}
          disabled={subscribing}
          className="nm-raised-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-all disabled:opacity-50"
        >
          {subscribing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Plus className="h-3 w-3" />
          )}
          Subscribe
        </button>
      </div>
    </div>
  );
}
