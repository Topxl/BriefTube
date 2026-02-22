"use client";

import { useRef, useState, useCallback } from "react";

const SPEEDS = [1, 1.5, 2, 3, 4] as const;

type Props = {
  src: string;
};

export function ShareAudioPlayer({ src }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);

  const cycleSpeed = useCallback(() => {
    const audio = audioRef.current;
    const idx = SPEEDS.indexOf(speed);
    const next = SPEEDS[(idx + 1) % SPEEDS.length];
    setSpeed(next);
    if (audio) audio.playbackRate = next;
  }, [speed]);

  return (
    <div className="flex items-center gap-3">
      <audio ref={audioRef} controls src={src} className="flex-1" />
      <button
        onClick={cycleSpeed}
        className="nm-raised-sm text-muted-foreground hover:text-foreground shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold tabular-nums transition-all"
      >
        x{speed}
      </button>
    </div>
  );
}
