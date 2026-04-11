"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Search, Youtube, X, Loader2, Play, Check } from "@/lib/icons";
import { toast } from "sonner";
import { openUpsellModal } from "@/components/dashboard/upsell-modal";
import { addProcessingVideo } from "@/lib/processing-videos";
import { useSummarizeVideo } from "@/hooks/use-summarize-video";
import { extractVideoId } from "@/lib/youtube-id";

function isYouTubeInput(val: string): boolean {
  const v = val.trim();
  return (
    v.includes("youtube.com") ||
    v.includes("youtu.be") ||
    v.startsWith("@") ||
    /^UC[\w-]{10,}$/.test(v)
  );
}

type LinkPreview = {
  type: "video" | "channel";
  videoId?: string;
  title?: string;
  channelName: string;
  channelId: string;
  thumbnail?: string;
  isSubscribed: boolean;
};

export function ChannelSearchBar() {
  const [q, setQ] = useState("");
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const { summarize, loading: summarizing } = useSummarizeVideo();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  const trimmed = q.trim();
  const isYT = trimmed.length > 0 && isYouTubeInput(trimmed);

  // Debounced preview fetch
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!isYT) {
      setPreview(null);
      setLoadingPreview(false);
      return;
    }

    // Show thumbnail instantly for video URLs — no network call needed
    const instantVideoId = extractVideoId(trimmed);
    if (instantVideoId) {
      setPreview((prev) =>
        prev?.videoId === instantVideoId
          ? prev
          : {
              type: "video",
              videoId: instantVideoId,
              thumbnail: `https://img.youtube.com/vi/${instantVideoId}/mqdefault.jpg`,
              channelName: "",
              channelId: "",
              isSubscribed: false,
            },
      );
    }

    setLoadingPreview(true);
    debounceRef.current = setTimeout(() => {
      fetch(`/api/link-preview?url=${encodeURIComponent(trimmed)}`)
        .then(async (r) => r.json() as Promise<LinkPreview>)
        .then((data) => {
          setPreview(data);
          setLoadingPreview(false);
        })
        .catch(() => {
          setLoadingPreview(false);
        });
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [trimmed, isYT]);

  const handleSubscribe = async () => {
    if (!preview) return;
    setSubscribing(true);
    try {
      const payload = preview.channelId
        ? {
            channelId: preview.channelId,
            channelName: preview.channelName,
            videoId: preview.videoId,
            videoTitle: preview.title,
          }
        : { url: trimmed };
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        active?: boolean;
        error?: string;
        videoId?: string | null;
        videoTitle?: string | null;
      };
      if (!res.ok) {
        toast.error(data.error ?? "Failed to add channel");
        return;
      }
      if (data.active) {
        toast.success("Channel added");
      } else {
        openUpsellModal();
        toast.info("Channel added but paused — upgrade to activate it");
      }
      setPreview((p) => (p ? { ...p, isSubscribed: true } : p));
      if (data.videoId) {
        addProcessingVideo({
          videoId: data.videoId,
          title: data.videoTitle ?? data.videoId,
          startedAt: Date.now(),
        });
      }
      setQ("");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubscribing(false);
    }
  };

  const handleSummarize = async () => {
    // Try preview first, fallback to client-side extraction, fallback to raw URL
    const clientVideoId = preview?.videoId ?? extractVideoId(trimmed);
    const videoIdOrUrl = clientVideoId ?? trimmed;
    if (!videoIdOrUrl) return;
    const previewTitle = preview?.title;
    await summarize(
      { videoId: videoIdOrUrl, videoTitle: previewTitle },
      {
        // The hook now uses videoId + videoTitle from the API response,
        // so it correctly tracks even when clientVideoId was null (raw URL).
        trackProcessing: true,
        onSuccess: ({ queued }) => {
          if (!queued) {
            window.dispatchEvent(
              new CustomEvent("summariesHighlight", {
                detail: { videoId: clientVideoId ?? videoIdOrUrl },
              }),
            );
          }
          setQ("");
        },
      },
    );
  };

  return (
    <div className="relative">
      <div className="relative w-full" suppressHydrationWarning>
        {isYT ? (
          <Youtube className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
        ) : (
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
        )}
        <Input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Paste a YouTube URL or @handle..."
          className="scrollbar-fade-x placeholder:text-muted-foreground/60 h-9 rounded-full border-white/[0.07] bg-[oklch(0.18_0_0)]/50 pr-8 pl-7 text-sm shadow-[0_4px_16px_rgba(0,0,0,0.3)] backdrop-blur-xl focus-visible:border-white/[0.12] focus-visible:ring-0"
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          data-form-type="other"
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setPreview(null);
            }}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {isYT && (loadingPreview || preview) && (
        <div className="nm-inset-sm absolute top-full right-0 left-0 z-50 mt-1 rounded-xl bg-[oklch(0.18_0_0)] p-3">
          {preview ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-start gap-3">
                {preview.thumbnail ? (
                  <img
                    src={preview.thumbnail}
                    alt={preview.title ?? preview.channelName}
                    className="h-14 w-24 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="nm-raised-sm flex h-14 w-14 shrink-0 items-center justify-center rounded-lg">
                    <Youtube className="text-muted-foreground h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  {preview.title ? (
                    <p className="line-clamp-2 text-xs font-medium">
                      {preview.title}
                    </p>
                  ) : (
                    <div className="bg-muted/50 mb-1 h-3 w-3/4 animate-pulse rounded" />
                  )}
                  {preview.channelName ? (
                    <p className="text-muted-foreground text-[11px]">
                      {preview.channelName}
                    </p>
                  ) : (
                    <div className="bg-muted/50 h-2.5 w-1/2 animate-pulse rounded" />
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {!preview.isSubscribed && (
                  <button
                    onClick={() => void handleSubscribe()}
                    disabled={subscribing || summarizing}
                    className="nm-raised-sm text-muted-foreground hover:text-foreground flex items-center gap-1 rounded-full px-3 py-1 text-xs transition-all disabled:opacity-50"
                  >
                    {subscribing ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : null}
                    Subscribe
                  </button>
                )}
                {preview.isSubscribed && (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                    <Check className="h-3 w-3" /> Subscribed
                  </span>
                )}
                {preview.type === "video" && (
                  <button
                    onClick={() => void handleSummarize()}
                    disabled={subscribing || summarizing}
                    className="nm-raised-sm flex items-center gap-1 rounded-full bg-red-600/10 px-3 py-1 text-xs text-red-400 transition-all hover:bg-red-600/20 disabled:opacity-50"
                  >
                    {summarizing ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                    Summarize
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
