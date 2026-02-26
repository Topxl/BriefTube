"use client";

import { useState } from "react";
import { Check, Search } from "@/lib/icons";
import { Input } from "@/components/ui/input";

const CATEGORY_VISUALS: Record<
  string,
  { gradient: string; accent: string; icon: string }
> = {
  Business: {
    gradient: "linear-gradient(145deg, #0c1e4a 0%, #09090b 55%)",
    accent: "#3b82f6",
    icon: "M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zm0 0V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2",
  },
  Education: {
    gradient: "linear-gradient(145deg, #3b1000 0%, #09090b 55%)",
    accent: "#f97316",
    icon: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  },
  Finance: {
    gradient: "linear-gradient(145deg, #052e16 0%, #09090b 55%)",
    accent: "#22c55e",
    icon: "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  },
  Science: {
    gradient: "linear-gradient(145deg, #1e0a4a 0%, #09090b 55%)",
    accent: "#a855f7",
    icon: "M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18",
  },
  Tech: {
    gradient: "linear-gradient(145deg, #031f20 0%, #09090b 55%)",
    accent: "#14b8a6",
    icon: "M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18",
  },
};

export type ListPickerItem = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  channelCount: number;
  followerCount: number;
};

type Props = {
  lists: ListPickerItem[];
  selectedIds: string[];
  onToggle: (id: string) => void;
};

export function ListPicker({ lists, selectedIds, onToggle }: Props) {
  const [search, setSearch] = useState("");

  const filtered = lists
    .filter((l) => {
      const q = search.toLowerCase();
      return (
        l.name.toLowerCase().includes(q) ||
        (l.category ?? "").toLowerCase().includes(q) ||
        (l.description ?? "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => b.followerCount - a.followerCount);

  return (
    <div suppressHydrationWarning className="flex flex-col gap-3">
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search playlists..."
          className="nm-inset border-transparent bg-transparent pl-9 focus-visible:ring-0"
          suppressHydrationWarning
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          No playlists found.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {filtered.map((list) => {
            const isSelected = selectedIds.includes(list.id);
            const visual = list.category
              ? CATEGORY_VISUALS[list.category]
              : undefined;

            return (
              <button
                key={list.id}
                type="button"
                onClick={() => onToggle(list.id)}
                suppressHydrationWarning
                className={`relative flex flex-col gap-1 overflow-hidden rounded-xl p-3 text-left transition-all ${
                  isSelected ? "nm-inset" : "nm-raised-sm hover:text-foreground"
                }`}
                style={visual ? { background: visual.gradient } : undefined}
              >
                {/* Category icon watermark */}
                {visual && (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={visual.accent}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="absolute right-2 bottom-2 h-10 w-10 opacity-15"
                    aria-hidden
                  >
                    <path d={visual.icon} />
                  </svg>
                )}

                {/* Accent dot */}
                {visual && (
                  <div
                    className="absolute top-0 left-0 h-0.5 w-full rounded-t-xl"
                    style={{ background: visual.accent }}
                  />
                )}

                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm leading-snug font-medium">
                    {list.name.replace("Best of ", "")}
                  </p>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="text-muted-foreground/50 text-[10px]">
                      {list.followerCount} subs
                    </span>
                    {isSelected && <Check className="h-3 w-3 text-red-400" />}
                  </div>
                </div>
                <p className="text-muted-foreground text-[10px]">
                  {list.channelCount} channels
                  {list.category ? ` · ${list.category}` : ""}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
