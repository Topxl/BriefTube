"use client";

import { useRef, useState, useCallback } from "react";
import { t } from "@/locales";

const tl = t.landing.hero;

const SPEEDS = [1, 1.5, 2, 3, 4] as const;
type Speed = (typeof SPEEDS)[number];

type CardState = {
  playing: boolean;
  currentTime: number;
  duration: number;
  speed: Speed;
};

const R2 = "https://pub-56ac81959a8e42beae1539d791297d90.r2.dev";

const DEMO_CARDS = [
  {
    channel: tl.mockupVideo1Channel,
    title: tl.mockupVideo1Title,
    thumb: "/demo-thumb-1.webp",
    src: `${R2}/audio/qp0HIF3SfI4_en.mp3`,
    fallbackDuration: 167, // 2:47
  },
  {
    channel: tl.mockupVideo2Channel,
    title: tl.mockupVideo2Title,
    thumb: "/demo-thumb-2.webp",
    src: `${R2}/audio/nm1TxQj9IsQ_en.mp3`,
    fallbackDuration: 203, // 3:23
  },
] as const;

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function HeroPlayer() {
  const [cards, setCards] = useState<[CardState, CardState]>([
    {
      playing: false,
      currentTime: 0,
      duration: DEMO_CARDS[0].fallbackDuration,
      speed: 1,
    },
    {
      playing: false,
      currentTime: 0,
      duration: DEMO_CARDS[1].fallbackDuration,
      speed: 1,
    },
  ]);

  // Single stable ref holding both audio elements — never goes in hook deps
  const audiosRef = useRef<(HTMLAudioElement | null)[]>([null, null]);

  const patchCard = useCallback((index: number, patch: Partial<CardState>) => {
    setCards((prev) => {
      const next = [...prev] as [CardState, CardState];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }, []);

  const togglePlay = useCallback(
    (index: number) => {
      const audio = audiosRef.current[index];
      if (!audio) return;
      const other = index === 0 ? 1 : 0;
      const otherAudio = audiosRef.current[other];

      if (!audio.paused) {
        audio.pause();
        patchCard(index, { playing: false });
      } else {
        // Pause the other card if it's playing
        if (otherAudio && !otherAudio.paused) {
          otherAudio.pause();
          patchCard(other, { playing: false });
        }
        void audio.play();
        patchCard(index, { playing: true });
      }
    },
    [patchCard],
  );

  const cycleSpeed = useCallback(
    (index: number) => {
      const audio = audiosRef.current[index];
      const cur = cards[index].speed;
      const next = SPEEDS[(SPEEDS.indexOf(cur) + 1) % SPEEDS.length];
      if (audio) audio.playbackRate = next;
      patchCard(index, { speed: next });
    },
    [cards, patchCard],
  );

  const seekTo = useCallback(
    (index: number, ratio: number) => {
      const audio = audiosRef.current[index];
      if (!audio || !cards[index].duration) return;
      const time = Math.max(0, Math.min(ratio, 1)) * cards[index].duration;
      audio.currentTime = time;
      patchCard(index, { currentTime: time });
    },
    [cards, patchCard],
  );

  return (
    <div className="mx-auto mt-16 min-h-[230px] max-w-sm">
      <div className="nm-raised rounded-2xl p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 shadow-[0_0_16px_rgba(239,68,68,0.3)]">
            <svg
              width="22"
              height="18"
              viewBox="0 0 20 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M0 0L9 8L0 16V0Z" fill="white" />
              <path d="M11 0L20 8L11 16V0Z" fill="white" opacity="0.85" />
            </svg>
          </div>
          <div className="text-left">
            <p className="text-sm font-medium">BriefTube</p>
            <p className="text-muted-foreground text-xs">{tl.mockupBotRole}</p>
          </div>
        </div>

        <div className="space-y-3">
          {DEMO_CARDS.map((demo, i) => {
            const card = cards[i];
            const progress =
              card.duration > 0 ? card.currentTime / card.duration : 0;

            return (
              <div
                key={i}
                className="nm-inset relative overflow-hidden rounded-xl p-3"
              >
                {/* Thumbnail background — plain img so preload hint matches exactly */}
                <img
                  src={demo.thumb}
                  alt=""
                  width={480}
                  height={360}
                  fetchPriority={i === 0 ? "high" : "low"}
                  loading={i === 0 ? "eager" : "lazy"}
                  className="absolute inset-0 h-full w-full object-cover opacity-[0.15]"
                />

                {/* Hidden audio element — preload metadata for duration */}
                <audio
                  ref={(el) => {
                    audiosRef.current[i] = el;
                  }}
                  src={demo.src}
                  preload="none"
                  onLoadedMetadata={(e) =>
                    patchCard(i, { duration: e.currentTarget.duration })
                  }
                  onTimeUpdate={(e) =>
                    patchCard(i, {
                      currentTime: e.currentTarget.currentTime,
                    })
                  }
                  onEnded={() =>
                    patchCard(i, { playing: false, currentTime: 0 })
                  }
                />

                <div className="relative">
                  <p className="text-muted-foreground text-xs font-medium">
                    {demo.channel}
                  </p>
                  <p className="text-sm font-medium">{demo.title}</p>

                  <div className="mt-2 flex items-center gap-2">
                    {/* Play / Pause */}
                    <button
                      onClick={() => togglePlay(i)}
                      aria-label={card.playing ? "Pause" : "Play"}
                      className="nm-raised-sm flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-red-600/[0.15] text-red-400 transition-colors hover:bg-red-600/[0.25]"
                    >
                      {card.playing ? (
                        <svg
                          className="h-3.5 w-3.5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zM12.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z" />
                        </svg>
                      ) : (
                        <svg
                          className="h-4 w-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                        </svg>
                      )}
                    </button>

                    {/* Clickable progress bar */}
                    <div
                      role="progressbar"
                      aria-label={`${demo.title} — playback progress`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(progress * 100)}
                      className="relative h-1 flex-1 cursor-pointer rounded-full bg-white/[0.08]"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        seekTo(i, (e.clientX - rect.left) / rect.width);
                      }}
                    >
                      <div
                        className="h-1 w-full rounded-full bg-red-500 duration-100"
                        style={{
                          transform: `scaleX(${progress})`,
                          transformOrigin: "left",
                          transition: "transform 0.1s linear",
                        }}
                      />
                    </div>

                    {/* Current time / total duration */}
                    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                      {card.playing
                        ? formatTime(card.currentTime)
                        : formatTime(card.duration)}
                    </span>

                    {/* Speed cycling */}
                    <button
                      onClick={() => cycleSpeed(i)}
                      className="text-muted-foreground hover:text-foreground shrink-0 text-xs font-semibold tabular-nums transition-colors"
                    >
                      x{card.speed}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
