"use client";

import { useState } from "react";
import { Check, Search } from "@/lib/icons";
import { Input } from "@/components/ui/input";

export type ListPickerItem = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  channelCount: number;
};

type Props = {
  lists: ListPickerItem[];
  selectedIds: string[];
  onToggle: (id: string) => void;
};

export function ListPicker({ lists, selectedIds, onToggle }: Props) {
  const [search, setSearch] = useState("");

  const filtered = lists.filter((l) => {
    const q = search.toLowerCase();
    return (
      l.name.toLowerCase().includes(q) ||
      (l.category ?? "").toLowerCase().includes(q) ||
      (l.description ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search playlists..."
          className="pl-9"
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
            return (
              <button
                key={list.id}
                type="button"
                onClick={() => onToggle(list.id)}
                className={`flex flex-col gap-1 rounded-xl border p-3 text-left transition-all ${
                  isSelected
                    ? "border-red-500/30 bg-red-500/[0.06] ring-1 ring-red-500/20"
                    : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm leading-snug font-medium">
                    {list.name.replace("Best of ", "")}
                  </p>
                  {isSelected && (
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                  )}
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
