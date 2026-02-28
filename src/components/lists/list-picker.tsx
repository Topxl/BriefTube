"use client";

import Image from "next/image";
import { Check } from "@/lib/icons";

// Representative YouTube video thumbnails + accent color per category
// Videos: Simon Sinek TEDx · 3Blue1Brown neural nets · Ray Dalio economic machine · Kurzgesagt Fermi Paradox · Unsplash circuit board
const CATEGORY_VISUALS: Record<
  string,
  { image: string; accent: string; fallback: string }
> = {
  Business: {
    image: "https://img.youtube.com/vi/UF8uR6Z6KLc/hqdefault.jpg",
    accent: "#3b82f6",
    fallback: "#0c1e4a",
  },
  Education: {
    image: "https://img.youtube.com/vi/aircAruvnKk/hqdefault.jpg",
    accent: "#f97316",
    fallback: "#3b1000",
  },
  Finance: {
    image: "https://img.youtube.com/vi/PHe0bXAIuk0/hqdefault.jpg",
    accent: "#22c55e",
    fallback: "#052e16",
  },
  Science: {
    image: "https://img.youtube.com/vi/sNhhvQGsMEc/hqdefault.jpg",
    accent: "#a855f7",
    fallback: "#1e0a4a",
  },
  Tech: {
    image:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=400&q=80",
    accent: "#14b8a6",
    fallback: "#031f20",
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
  const filtered = lists
    .filter((l) => l.category !== null && l.category !== "Other")
    .sort((a, b) => b.followerCount - a.followerCount);

  if (filtered.length === 0) return null;

  return (
    <div suppressHydrationWarning className="grid grid-cols-2 gap-2">
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
            className={`relative h-24 overflow-hidden rounded-xl text-left transition-all ${
              isSelected ? "ring-2 ring-red-500" : "hover:brightness-110"
            }`}
            style={{ background: visual?.fallback ?? "#09090b" }}
          >
            {/* Background image */}
            {visual && (
              <Image
                src={visual.image}
                alt={list.category ?? ""}
                fill
                sizes="250px"
                className="object-cover opacity-55"
              />
            )}

            {/* Bottom gradient for text legibility */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

            {/* Accent stripe at top */}
            {visual && (
              <div
                className="absolute top-0 left-0 h-[2px] w-full"
                style={{ background: visual.accent }}
              />
            )}

            {/* Selected checkmark */}
            {isSelected && (
              <div className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500">
                <Check className="h-2.5 w-2.5 text-white" />
              </div>
            )}

            {/* Text overlay */}
            <div className="absolute right-0 bottom-0 left-0 p-2.5">
              <p className="text-[13px] leading-tight font-semibold text-white">
                {list.name.replace("Best of ", "")}
              </p>
              <p className="mt-0.5 text-[10px] text-white/55">
                {list.channelCount} channels
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
