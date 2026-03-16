"use client";

import { useState, useEffect, useMemo, useSyncExternalStore } from "react";
import { X, CheckCircle } from "@/lib/icons";
import { createClient } from "@/lib/supabase/client";
import {
  type ProcessingVideo,
  getProcessingVideos,
  removeProcessingVideo,
} from "@/lib/processing-videos";

// Stages calibrated to real worker timing (median 69s, P75 119s, P90 200s)
const STAGES = [
  { until: 30, label: "Extraction de la transcription…", step: 0 },
  { until: 70, label: "Analyse du contenu…", step: 1 },
  { until: 110, label: "Génération du résumé IA…", step: 1 },
  { until: 150, label: "Synthèse vocale en cours…", step: 2 },
  { until: 190, label: "Upload de l'audio…", step: 2 },
  { until: Infinity, label: "Livraison en cours…", step: 3 },
] as const;

const STEP_LABELS = ["Transcription", "Résumé", "Audio", "Livraison"] as const;

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

  // On mount: check if already completed (e.g. card stuck from before Realtime was added)
  useEffect(() => {
    supabase
      .from("processed_videos")
      .select("status")
      .eq("video_id", video.videoId)
      .maybeSingle()
      .then(
        ({ data }) => {
          if (data?.status === "completed") {
            setDone(true);
            setTimeout(() => removeProcessingVideo(video.videoId), 2500);
          } else if (data?.status === "failed") {
            removeProcessingVideo(video.videoId);
          }
        },
        (_err) => {
          /* ignore network errors */
        },
      );
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
              Résumé envoyé sur Telegram !
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

          {/* Progress bar */}
          <div className="bg-muted mt-2 h-1 overflow-hidden rounded-full">
            <div
              className="h-full rounded-full bg-red-500 transition-all duration-1000 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Step dots */}
          <div className="mt-2 flex w-full items-center">
            {STEP_LABELS.map((label, i) => (
              <div key={label} className="flex min-w-0 flex-1 items-center">
                <div className="flex min-w-0 items-center gap-0.5">
                  <div
                    className={`h-1 w-1 shrink-0 rounded-full transition-colors duration-700 ${
                      i <= stage.step ? "bg-red-500" : "bg-white/15"
                    }`}
                  />
                  <span
                    className={`truncate text-[9px] transition-colors duration-700 ${
                      i === stage.step
                        ? "text-white/60"
                        : i < stage.step
                          ? "text-white/30"
                          : "text-white/15"
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div
                    className={`mx-1 h-px flex-1 transition-colors duration-700 ${
                      i < stage.step ? "bg-red-500/30" : "bg-white/8"
                    }`}
                  />
                )}
              </div>
            ))}
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

  if (videos.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {videos.map((v) => (
        <ProcessingCard key={v.videoId} video={v} />
      ))}
    </div>
  );
}
