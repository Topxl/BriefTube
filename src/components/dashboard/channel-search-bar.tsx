"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Youtube, X, Plus, Loader2 } from "@/lib/icons";
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

function isVideoUrl(val: string): boolean {
  return /(?:watch\?(?:[^&]*&)*v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/.test(val);
}

export function ChannelSearchBar() {
  const [q, setQ] = useQueryState("q", { defaultValue: "", shallow: true });
  const [adding, setAdding] = useState(false);
  const [processingVideo, setProcessingVideo] = useState<{
    videoId: string;
    title: string;
  } | null>(null);
  const router = useRouter();

  const trimmed = q.trim();
  const isAddMode = trimmed.length > 0 && isYouTubeInput(trimmed);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmed || !isAddMode) return;
    setAdding(true);
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
        toast.success("Channel added and active");
      } else {
        openUpsellModal();
        toast.info("Channel added but paused — upgrade to activate it");
      }
      if (data.videoId && isVideoUrl(trimmed)) {
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
      setAdding(false);
    }
  };

  return (
    <div className="flex flex-col gap-0">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="flex w-full gap-2"
        data-form-type="other"
        suppressHydrationWarning
      >
        <div className="relative flex-1">
          {isAddMode ? (
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
              onClick={() => void setQ(null)}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {isAddMode && (
          <Button
            type="submit"
            disabled={adding}
            size="sm"
            className="h-9 shrink-0 bg-red-600 shadow-[0_0_12px_rgba(239,68,68,0.15)] hover:bg-red-500"
          >
            {adding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        )}
      </form>
      {processingVideo && (
        <VideoProcessingCard
          videoId={processingVideo.videoId}
          title={processingVideo.title}
          onDismiss={() => setProcessingVideo(null)}
        />
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
    <div className="nm-inset-sm mt-2 rounded-xl p-3">
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
