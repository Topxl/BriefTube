"use client";

import { useState, useEffect } from "react";
import { useQueryState } from "nuqs";
import { X } from "@/lib/icons";

export function ProcessingVideoCard() {
  const [videoId, setVideoId] = useQueryState("processingVideoId", {
    defaultValue: "",
    shallow: false,
  });
  const [title, setTitle] = useQueryState("processingVideoTitle", {
    defaultValue: "",
    shallow: false,
  });
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!videoId) return;
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
  }, [videoId]);

  if (!videoId) return null;

  const handleDismiss = async () => {
    await setVideoId(null);
    await setTitle(null);
  };

  return (
    <div className="nm-inset-sm rounded-xl bg-[oklch(0.18_0_0)] p-3">
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
          onClick={() => void handleDismiss()}
          className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
