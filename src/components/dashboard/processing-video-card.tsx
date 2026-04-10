"use client";

import { useState, useEffect, useMemo, useSyncExternalStore } from "react";
import { X, CheckCircle } from "@/lib/icons";
import { createClient } from "@/lib/supabase/client";
import {
  type ProcessingVideo,
  addProcessingVideo,
  getProcessingVideos,
  removeProcessingVideo,
} from "@/lib/processing-videos";

// Stages calibrated to real worker timing (median 69s, P75 119s, P90 200s)
const STAGES = [
  { until: 30, label: "Extracting transcript…", step: 0 },
  { until: 70, label: "Analyzing content…", step: 1 },
  { until: 110, label: "Generating AI summary…", step: 1 },
  { until: 150, label: "Generating audio…", step: 2 },
  { until: 190, label: "Uploading audio…", step: 2 },
  { until: Infinity, label: "Delivering…", step: 3 },
] as const;

function getStage(elapsedSeconds: number) {
  return (
    STAGES.find((s) => elapsedSeconds < s.until) ?? STAGES[STAGES.length - 1]
  );
}

function calcProgress(startedAt: number): number {
  // base=0.990 → ~22% at 30s, ~43% at 69s (median), ~59% at 120s, ~74% at 200s (P90)
  // Always leaves room for Realtime completion to feel like a positive surprise
  const elapsed = (Date.now() - startedAt) / 1000;
  return 85 * (1 - Math.pow(0.99, elapsed));
}

function ProcessingCard({ video }: { video: ProcessingVideo }) {
  const supabase = useMemo(() => createClient(), []);
  const [elapsed, setElapsed] = useState(
    () => (Date.now() - video.startedAt) / 1000,
  );
  const [progress, setProgress] = useState(() => calcProgress(video.startedAt));
  const [done, setDone] = useState(false);

  const stage = getStage(elapsed);

  // Tick every second
  useEffect(() => {
    const interval = setInterval(() => {
      const newElapsed = (Date.now() - video.startedAt) / 1000;
      setElapsed(newElapsed);
      setProgress(85 * (1 - Math.pow(0.985, newElapsed)));
    }, 1000);
    return () => clearInterval(interval);
  }, [video.startedAt]);

  // Poll the status every 5s as a fallback for Realtime (which can lag)
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const { data } = await supabase
        .from("processed_videos")
        .select("status, audio_url")
        .eq("video_id", video.videoId)
        .not("audio_url", "is", null)
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (data?.status === "completed") {
        setDone(true);
        // Promote the video to the top of the feed immediately
        window.dispatchEvent(
          new CustomEvent("summariesHighlight", {
            detail: { videoId: video.videoId },
          }),
        );
        setTimeout(() => removeProcessingVideo(video.videoId), 2500);
        return true;
      }
      if (data?.status === "failed") {
        removeProcessingVideo(video.videoId);
        return true;
      }
      return false;
    };
    // Immediate check on mount
    void check();
    // Then poll every 5s
    const interval = setInterval(() => {
      void check().then((stopped) => {
        if (stopped) clearInterval(interval);
      });
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [video.videoId, supabase]);

  // Realtime: auto-dismiss when the video is done
  useEffect(() => {
    const channel = supabase
      .channel(`processing-${video.videoId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "processed_videos",
          filter: `video_id=eq.${video.videoId}`,
        },
        (payload) => {
          const newStatus = (payload.new as { status?: string }).status;
          if (newStatus === "completed") {
            setDone(true);
            window.dispatchEvent(
              new CustomEvent("summariesHighlight", {
                detail: { videoId: video.videoId },
              }),
            );
            setTimeout(() => removeProcessingVideo(video.videoId), 2500);
          } else if (newStatus === "failed") {
            removeProcessingVideo(video.videoId);
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [video.videoId, supabase]);

  // Done flash state
  if (done) {
    return (
      <div className="nm-inset-sm flex items-center gap-3 rounded-xl bg-[oklch(0.18_0_0)] p-3 transition-all duration-300">
        <img
          src={`https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`}
          alt={video.title}
          className="h-14 w-24 shrink-0 rounded-lg object-cover opacity-50"
        />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
          <div className="min-w-0">
            <p className="line-clamp-1 text-xs font-medium">{video.title}</p>
            <p className="mt-0.5 text-[11px] text-emerald-400">
              Summary ready!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="nm-inset-sm rounded-xl bg-[oklch(0.18_0_0)] p-3">
      <div className="flex items-start gap-3">
        <img
          src={`https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`}
          alt={video.title}
          className="h-14 w-24 shrink-0 rounded-lg object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-xs font-medium">{video.title}</p>
          <p className="text-muted-foreground mt-0.5 text-[11px] transition-all duration-700">
            {stage.label}
          </p>

          {/* Progress bar with energy shimmer */}
          <div className="bg-muted relative mt-2 h-1 overflow-hidden rounded-full">
            <div
              className="h-full rounded-full bg-red-500 transition-all duration-1000 ease-out"
              style={{ width: `${progress}%` }}
            />
            <div
              className="absolute inset-0 rounded-full"
              style={{
                width: `${progress}%`,
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 1.5s ease-in-out infinite",
              }}
            />
            <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
          </div>
        </div>

        <button
          type="button"
          onClick={() => removeProcessingVideo(video.videoId)}
          className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// Module-level cache so getSnapshot returns a stable reference between events.
// useSyncExternalStore uses Object.is — a new array every call causes infinite loops.
let _snapshot: ProcessingVideo[] = [];
// Stable empty array for getServerSnapshot — must be the same reference on every call.
const _EMPTY: ProcessingVideo[] = [];

function subscribeProcessingVideos(cb: () => void) {
  // Initialise cache on first subscribe (client-side only)
  _snapshot = getProcessingVideos();
  const handler = () => {
    _snapshot = getProcessingVideos(); // update before notifying React
    cb();
  };
  window.addEventListener("processingVideosChanged", handler);
  return () => window.removeEventListener("processingVideosChanged", handler);
}

export function ProcessingVideoCard() {
  // useSyncExternalStore: stable server snapshot ([]) avoids hydration mismatch,
  // stable client snapshot avoids infinite re-render loop
  const videos = useSyncExternalStore(
    subscribeProcessingVideos,
    () => _snapshot,
    () => _EMPTY,
  );

  // On mount: hydrate from processing_queue DB rows so cards survive page refresh
  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      void supabase
        .from("processing_queue")
        .select("video_id, video_title, created_at")
        .in("status", ["queued", "processing"])
        .order("created_at", { ascending: false })
        .limit(10)
        .then(({ data }) => {
          if (!data || data.length === 0) return;
          const existing = getProcessingVideos();
          const existingIds = new Set(existing.map((v) => v.videoId));
          for (const row of data) {
            if (!existingIds.has(row.video_id)) {
              addProcessingVideo({
                videoId: row.video_id,
                title: row.video_title ?? row.video_id,
                startedAt: new Date(row.created_at ?? Date.now()).getTime(),
              });
            }
          }
        });
    });
  }, []);

  if (videos.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {videos.map((v) => (
        <ProcessingCard key={v.videoId} video={v} />
      ))}
    </div>
  );
}
