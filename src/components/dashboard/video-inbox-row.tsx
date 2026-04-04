"use client";

import { useState, useCallback } from "react";
import { Play, Plus, Loader2, MoreHorizontal, ExternalLink, Share2 } from "@/lib/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { addProcessingVideo } from "@/lib/processing-videos";
import { SiteConfig } from "@/site-config";

type Props = {
  videoId: string;
  channelId: string;
  title: string;
  publishedAt: string;
  videoStatus?: string;
  isSubscribed?: boolean;
  channelActive?: boolean;
  onToggleChannel?: () => void;
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
  videoStatus,
  isSubscribed = false,
  channelActive,
  onToggleChannel,
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
      const data = (await res.json()) as { queued?: boolean };
      if (data.queued) {
        addProcessingVideo({
          videoId,
          title,
          startedAt: Date.now(),
        });
        toast.success("Summary requested — processing started");
      } else {
        // Already processed — highlight in feed
        window.dispatchEvent(
          new CustomEvent("summariesHighlight", {
            detail: { videoId },
          }),
        );
      }
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
      // Use URL format so the API resolves channelName + avatar automatically
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: `https://www.youtube.com/channel/${channelId}`,
        }),
      });
      const data = (await res.json()) as {
        active?: boolean;
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? "Failed to subscribe");
        return;
      }
      toast.success(
        data.active
          ? "Subscribed — new videos will be summarized automatically"
          : "Channel added but paused — upgrade to activate it",
      );
    } catch {
      toast.error("Failed to subscribe");
    } finally {
      setSubscribing(false);
    }
  };

  const handleShare = useCallback(async () => {
    const url = `${SiteConfig.prodUrl}/videos/${videoId}`;
    try {
      await navigator.share({ title, url });
    } catch {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied!");
    }
  }, [title, videoId]);

  return (
    <div className="nm-raised relative overflow-hidden rounded-2xl opacity-80 transition-all duration-200 hover:opacity-100">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="text-muted-foreground hover:text-foreground absolute top-2 right-2 z-10 flex h-6 w-6 items-center justify-center rounded-md transition-colors">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem asChild>
            <a
              href={`https://www.youtube.com/watch?v=${videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open on YouTube
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => void handleShare()}
            className="flex items-center gap-2"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="flex items-start gap-3 p-3">
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

        {/* Title + date + actions */}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm leading-snug font-medium">
            {title}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-muted-foreground text-xs">
              {formatDate(publishedAt)}
            </span>
            {channelActive !== undefined && onToggleChannel && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleChannel();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    e.preventDefault();
                    onToggleChannel();
                  }
                }}
                className={`flex cursor-pointer items-center gap-1 rounded-full border px-1.5 py-px text-[10px] font-medium transition-all ${
                  channelActive
                    ? "hover:text-muted-foreground/50 border-green-500/20 text-green-500/60 hover:border-white/10"
                    : "text-muted-foreground/40 hover:text-foreground/60 border-white/[0.07] hover:border-white/10"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full transition-colors ${
                    channelActive ? "bg-green-500/60" : "bg-muted-foreground/25"
                  }`}
                />
                {channelActive ? "Active" : "Paused"}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            {videoStatus === "processing" ? (
              <span className="flex items-center gap-1 rounded-full border border-amber-500/20 px-1.5 py-px text-[10px] font-medium text-amber-400">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                Processing
              </span>
            ) : videoStatus === "failed" ? (
              <span className="text-muted-foreground/40 flex items-center gap-1 rounded-full border border-white/[0.07] px-1.5 py-px text-[10px] font-medium">
                Unavailable
              </span>
            ) : (
              <button
                onClick={() => void handleSummarize()}
                disabled={summarizing}
                className="flex items-center gap-1 rounded-full border border-red-500/20 px-1.5 py-px text-[10px] font-medium text-red-400 transition-all hover:text-red-300 disabled:opacity-50"
              >
                {summarizing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Play className="h-2.5 w-2.5" />
                )}
                Summarize
              </button>
            )}
            {!isSubscribed && (
              <button
                onClick={() => void handleSubscribe()}
                disabled={subscribing}
                className="text-muted-foreground/40 hover:text-foreground/60 flex items-center gap-1 rounded-full border border-white/[0.07] px-1.5 py-px text-[10px] font-medium transition-all hover:border-white/10 disabled:opacity-50"
              >
                {subscribing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Plus className="h-2.5 w-2.5" />
                )}
                Subscribe
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
