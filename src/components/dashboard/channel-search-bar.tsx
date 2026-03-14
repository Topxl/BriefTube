"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { Input } from "@/components/ui/input";
import { Search, Youtube, X, Loader2, Play, Check } from "@/lib/icons";
import { toast } from "sonner";
import { openUpsellModal } from "@/components/dashboard/upsell-modal";

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
  const [q, setQ] = useQueryState("q", { defaultValue: "", shallow: true });
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [processingVideo, setProcessingVideo] = useState<{
    videoId: string;
    title: string;
  } | null>(null);
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
    setLoadingPreview(true);
    debounceRef.current = setTimeout(() => {
      fetch(`/api/link-preview?url=${encodeURIComponent(trimmed)}`)
        .then(async (r) => r.json() as Promise<LinkPreview>)
        .then((data) => {
          setPreview(data);
          setLoadingPreview(false);
        })
        .catch(() => {
          setPreview(null);
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
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
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
        setProcessingVideo({
          videoId: data.videoId,
          title: data.videoTitle ?? data.videoId,
        });
      }
      await setQ(null);
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubscribing(false);
    }
  };

  const handleSummarize = async () => {
    if (!preview?.videoId) return;
    setSummarizing(true);
    try {
      if (!preview.isSubscribed) {
        // Subscribe + process video at the same time
        const res = await fetch("/api/subscriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: trimmed }),
        });
        const data = (await res.json()) as {
          active?: boolean;
          error?: string;
          videoId?: string | null;
          videoTitle?: string | null;
        };
        if (!res.ok && res.status !== 409) {
          toast.error(data.error ?? "Failed");
          return;
        }
        if (res.ok) {
          if (!data.active) openUpsellModal();
          setPreview((p) => (p ? { ...p, isSubscribed: true } : p));
        }
        if (data.videoId) {
          setProcessingVideo({
            videoId: data.videoId,
            title: data.videoTitle ?? data.videoId,
          });
          await setQ(null);
          router.refresh();
          return;
        }
      }
      // Already subscribed (or subscribe returned 409) — just process the video
      const res = await fetch("/api/process-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: preview.videoId,
          videoTitle: preview.title,
        }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        toast.error(d.error ?? "Failed");
        return;
      }
      setProcessingVideo({
        videoId: preview.videoId,
        title: preview.title ?? preview.videoId,
      });
      await setQ(null);
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSummarizing(false);
    }
  };

  return (
    <div className="relative">
      <div className="relative w-full">
        {isYT ? (
          <Youtube className="text-muted-foreground absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
        ) : (
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
        )}
        <Input
          type="text"
          value={q}
          onChange={(e) => void setQ(e.target.value || null)}
          placeholder="Search channels or paste a YouTube URL…"
          className="scrollbar-fade-x placeholder:text-muted-foreground/60 h-9 rounded-full border-white/[0.07] bg-[oklch(0.18_0_0)]/50 pr-8 pl-8 text-sm shadow-[0_4px_16px_rgba(0,0,0,0.3)] backdrop-blur-xl focus-visible:border-white/[0.12] focus-visible:ring-0"
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          data-form-type="other"
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              void setQ(null);
              setPreview(null);
            }}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {isYT && (loadingPreview || preview) && (
        <div className="nm-inset-sm absolute top-full right-0 left-0 z-50 mt-1 rounded-xl p-3">
          {loadingPreview && !preview ? (
            <div className="flex items-center gap-2">
              <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
              <span className="text-muted-foreground text-xs">
                Loading preview…
              </span>
            </div>
          ) : preview ? (
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
                {preview.title && (
                  <p className="line-clamp-2 text-xs font-medium">
                    {preview.title}
                  </p>
                )}
                <p className="text-muted-foreground text-[11px]">
                  {preview.channelName}
                </p>
                <div className="mt-2 flex gap-2">
                  {!preview.isSubscribed && (
                    <button
                      onClick={() => void handleSubscribe()}
                      disabled={subscribing || summarizing}
                      className="nm-raised-sm text-muted-foreground hover:text-foreground flex items-center gap-1 rounded-full px-3 py-1 text-xs transition-all disabled:opacity-50"
                    >
                      {subscribing ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : null}
                      S'abonner
                    </button>
                  )}
                  {preview.isSubscribed && (
                    <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                      <Check className="h-3 w-3" /> Abonné
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
                      Résumer
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {processingVideo && (
        <div className="absolute top-full right-0 left-0 z-50 mt-1">
          <VideoProcessingCard
            videoId={processingVideo.videoId}
            title={processingVideo.title}
            onDismiss={() => setProcessingVideo(null)}
          />
        </div>
      )}
    </div>
  );
}

function VideoProcessingCard({
  videoId,
  title,
  onDismiss,
}: {
  videoId: string;
  title: string;
  onDismiss: () => void;
}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Simulate progress: reaches ~85% in 3 minutes
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 85) {
          clearInterval(interval);
          return p;
        }
        return p + (85 - p) * 0.015;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="nm-inset-sm rounded-xl p-3">
      <div className="flex items-start gap-3">
        <img
          src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
          alt={title}
          className="h-14 w-24 shrink-0 rounded-lg object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-xs font-medium">{title}</p>
          <p className="text-muted-foreground mt-0.5 text-[11px]">
            Processing your summary…
          </p>
          <div className="bg-muted mt-2 h-1 overflow-hidden rounded-full">
            <div
              className="h-full rounded-full bg-red-500 transition-all duration-1000 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
