"use client";

import { Flame } from "@/lib/icons";

type Props = {
  streak: number;
};

export function StreakChipButton({ streak }: Props) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("open-stats"))}
      className="nm-raised flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm transition hover:brightness-110"
      title={`${streak} day streak — tap for details`}
      aria-label={`Open stats — current streak ${streak} days`}
    >
      <Flame className="h-3.5 w-3.5 text-red-500" />
      <span className="font-semibold text-red-500 tabular-nums">{streak}</span>
    </button>
  );
}
