"use client";

import { useState, useEffect, useCallback } from "react";
import { X } from "@/lib/icons";
import {
  type ProcessingVideo,
  getProcessingVideos,
  removeProcessingVideo,
} from "@/lib/processing-videos";

function calcProgress(startedAt: number): number {
  const elapsed = (Date.now() - startedAt) / 1000;
  return 85 * (1 - Math.pow(0.985, elapsed));
}

function ProcessingCard({ video }: { video: ProcessingVideo }) {
  const [progress, setProgress] = useState(() => calcProgress(video.startedAt));

  useEffect(() => {
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
    <div className="nm-inset-sm rounded-xl bg-[oklch(0.18_0_0)] p-3">
      <div className="flex items-start gap-3">
        <img
          src={`https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`}
          alt={video.title}
          className="h-14 w-24 shrink-0 rounded-lg object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-xs font-medium">{video.title}</p>
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
          onClick={() => removeProcessingVideo(video.videoId)}
          className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function ProcessingVideoCard() {
  const [videos, setVideos] = useState<ProcessingVideo[]>(() =>
    getProcessingVideos(),
  );

  const sync = useCallback(() => {
    setVideos(getProcessingVideos());
  }, []);

  useEffect(() => {
    window.addEventListener("processingVideosChanged", sync);
    return () => window.removeEventListener("processingVideosChanged", sync);
  }, [sync]);

  if (videos.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {videos.map((v) => (
        <ProcessingCard key={v.videoId} video={v} />
      ))}
    </div>
  );
}
