"use client";

import { useState } from "react";
import Image from "next/image";
import { useQueryState } from "nuqs";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Youtube, Trash2, ChevronDown, TriangleAlertIcon } from "@/lib/icons";
import { dialogManager } from "@/features/dialog-manager/dialog-manager";
import { openUpsellModal } from "@/components/dashboard/upsell-modal";
import { Banner } from "@/components/nowts/banner";
import type { Tables } from "@/types/supabase";

type Subscription = Tables<"subscriptions">;

const INITIAL_VISIBLE = 3;
const LOAD_MORE_STEP = 10;

type Props = {
  initialSources: Subscription[];
  maxChannels: number;
  isPro: boolean;
};

function SourceRow({
  source,
  selected,
  onSelect,
  onToggle,
  searchQuery,
}: {
  source: Subscription;
  selected: boolean;
  onSelect: (id: string) => void;
  onToggle: (source: Subscription) => void;
  searchQuery: string;
}) {
  const name = source.channel_name;
  const q = searchQuery.trim().toLowerCase();
  let nameEl: React.ReactNode = name;
  if (q) {
    const idx = name.toLowerCase().indexOf(q);
    if (idx !== -1) {
      nameEl = (
        <>
          {name.slice(0, idx)}
          <mark className="text-foreground rounded-sm bg-white/10">
            {name.slice(idx, idx + q.length)}
          </mark>
          {name.slice(idx + q.length)}
        </>
      );
    }
  }

  return (
    <div
      className={`group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.02] ${
        selected ? "bg-white/[0.04]" : ""
      }`}
    >
      {/* Avatar — cliquable pour sélectionner */}
      <button
        onClick={() => onSelect(source.id)}
        aria-label={selected ? "Deselect" : "Select"}
        className="relative shrink-0 cursor-pointer rounded-full transition-all"
      >
        {source.channel_avatar_url ? (
          <Image
            src={source.channel_avatar_url}
            alt={source.channel_name}
            width={32}
            height={32}
            className={`h-8 w-8 rounded-full transition-all ${
              !source.active && !selected ? "opacity-35" : ""
            } ${selected ? "opacity-50" : ""}`}
            suppressHydrationWarning
          />
        ) : (
          <div
            className={`bg-muted flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all ${
              !source.active && !selected ? "opacity-35" : ""
            } ${selected ? "opacity-50" : ""}`}
          >
            {source.channel_name.charAt(0).toUpperCase()}
          </div>
        )}

        {/* Overlay checkmark quand sélectionné */}
        {selected ? (
          <span className="bg-foreground/80 text-background absolute inset-0 flex items-center justify-center rounded-full text-[11px] font-bold">
            ✓
          </span>
        ) : (
          /* Hint hover — cercle subtil pour indiquer que c'est sélectionnable */
          <span className="absolute inset-0 rounded-full bg-white/0 transition-colors group-hover:bg-white/10" />
        )}
      </button>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-medium ${
            !source.active ? "text-muted-foreground/50" : ""
          }`}
        >
          {nameEl}
        </p>
        <a
          href={`https://www.youtube.com/channel/${source.channel_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground/40 hover:text-muted-foreground text-[11px] transition-colors"
        >
          YouTube
        </a>
      </div>

      {/* Status toggle */}
      <button
        onClick={() => onToggle(source)}
        className={`group/toggle flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-all ${
          source.active
            ? "hover:text-muted-foreground/50 border-green-500/20 text-green-500/60 hover:border-white/10"
            : "text-muted-foreground/40 hover:text-foreground/60 border-white/[0.07] hover:border-white/10"
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full transition-colors ${
            source.active
              ? "group-hover/toggle:bg-muted-foreground/40 bg-green-500/60"
              : "bg-muted-foreground/25 group-hover/toggle:bg-green-500/50"
          }`}
        />
        <span className="group-hover/toggle:hidden">
          {source.active ? "Active" : "Paused"}
        </span>
        <span className="hidden group-hover/toggle:inline">
          {source.active ? "Pause" : "Activate"}
        </span>
      </button>
    </div>
  );
}

export function SourcesSection({ initialSources, maxChannels, isPro }: Props) {
  const [sources, setSources] = useState<Subscription[]>(initialSources);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "paused">(
    "all",
  );
  const [q] = useQueryState("q", { defaultValue: "", shallow: true });
  const supabase = createClient();

  // Stable display order — active first, paused last — fixed at mount, never re-sorted
  const [displayedIds] = useState<string[]>(() => [
    ...initialSources.filter((s) => s.active).map((s) => s.id),
    ...initialSources.filter((s) => !s.active).map((s) => s.id),
  ]);

  const activeCount = sources.filter((s) => s.active).length;
  const atActiveLimit = !isPro && activeCount >= maxChannels;

  const isYouTubeQ =
    q.includes("youtube.com") ||
    q.includes("youtu.be") ||
    q.startsWith("@") ||
    /^UC[\w-]{10,}$/.test(q);
  const searchNorm = q.trim().length > 0 && !isYouTubeQ ? q.toLowerCase() : "";

  // Build ordered list using the stable display order
  const sourcesMap = new Map(sources.map((s) => [s.id, s]));
  const orderedSources = displayedIds
    .map((id) => sourcesMap.get(id))
    .filter((s): s is Subscription => s !== undefined);

  const filteredByStatus =
    filterStatus === "all"
      ? orderedSources
      : orderedSources.filter((s) =>
          filterStatus === "active" ? s.active : !s.active,
        );

  const displayedSources = searchNorm
    ? filteredByStatus.filter((s) =>
        s.channel_name.toLowerCase().includes(searchNorm),
      )
    : filteredByStatus.slice(0, visibleCount);

  const remainingCount = filteredByStatus.length - visibleCount;
  const hasMore = !searchNorm && visibleCount < filteredByStatus.length;
  const anySelected = selectedIds.size > 0;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const toggleActive = async (source: Subscription) => {
    const newActive = !source.active;
    if (newActive && atActiveLimit) {
      openUpsellModal();
      return;
    }
    setSources((prev) =>
      prev.map((s) => (s.id === source.id ? { ...s, active: newActive } : s)),
    );
    const res = await fetch("/api/subscriptions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: source.id, active: newActive }),
    });
    if (!res.ok) {
      setSources((prev) =>
        prev.map((s) =>
          s.id === source.id ? { ...s, active: source.active } : s,
        ),
      );
      toast.error("Failed to update channel");
    }
  };

  const handleBulkDelete = () => {
    const count = selectedIds.size;
    const ids = [...selectedIds];
    dialogManager.confirm({
      title: "Remove sources",
      description: `Remove ${count} channel${count > 1 ? "s" : ""} from your sources?`,
      variant: "destructive",
      action: {
        label: `Remove ${count}`,
        onClick: async () => {
          const { error } = await supabase
            .from("subscriptions")
            .delete()
            .in("id", ids);
          if (error) {
            toast.error("Failed to remove sources");
            return;
          }
          setSources((prev) => prev.filter((s) => !selectedIds.has(s.id)));
          setSelectedIds(new Set());
          toast.success(`${count} source${count > 1 ? "s" : ""} removed`);
        },
      },
    });
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Sources</h2>
          <span className="text-muted-foreground/50 text-xs tabular-nums">
            {isPro ? sources.length : `${activeCount}/${maxChannels}`}
          </span>
          <a
            href="/api/youtube/auth"
            className="nm-raised-sm text-muted-foreground/60 hover:text-foreground flex items-center gap-1 rounded-full px-2 py-1 text-[10px] transition-colors"
          >
            <Youtube className="h-3 w-3" />
            Import
          </a>
        </div>

        {/* Selection controls OR filter tabs */}
        {anySelected ? (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs tabular-nums">
              {selectedIds.size} selected
            </span>
            <button
              onClick={handleBulkDelete}
              className="nm-raised-sm flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium text-red-400 transition-colors hover:bg-red-500/10"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
            <button
              onClick={clearSelection}
              className="text-muted-foreground/40 hover:text-foreground text-xs transition-colors"
            >
              ✕
            </button>
          </div>
        ) : (
          sources.length > 0 && (
            <div className="flex items-center gap-1">
              {(["all", "active", "paused"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                    filterStatus === status
                      ? "nm-inset text-foreground"
                      : "nm-raised-sm text-muted-foreground/60 hover:text-foreground"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          )
        )}
      </div>

      <>
        {/* Active limit banner */}
        {atActiveLimit && (
          <Banner
            variant="warning"
            icon={
              <TriangleAlertIcon className="h-3.5 w-3.5 text-amber-300/70" />
            }
            title={`${maxChannels} channels reached`}
            description="Pause a channel to swap, or upgrade to Pro for unlimited."
            action={{ label: "Upgrade", onClick: () => openUpsellModal() }}
          />
        )}

        {sources.length === 0 ? (
          <div className="py-10 text-center">
            <div className="nm-inset mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl">
              <svg
                className="text-muted-foreground h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"
                />
              </svg>
            </div>
            <p className="text-sm font-medium">No sources yet</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Add a YouTube channel above to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="nm-raised overflow-hidden rounded-2xl">
              {displayedSources.length > 0 ? (
                <div className="divide-y divide-white/[0.04]">
                  {displayedSources.map((source) => (
                    <SourceRow
                      key={source.id}
                      source={source}
                      selected={selectedIds.has(source.id)}
                      onSelect={toggleSelect}
                      onToggle={toggleActive}
                      searchQuery={searchNorm}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground px-4 py-6 text-center text-sm">
                  No channel matching &ldquo;{q}&rdquo;
                </p>
              )}
            </div>

            {hasMore && (
              <button
                onClick={() => setVisibleCount((n) => n + LOAD_MORE_STEP)}
                className="text-muted-foreground/30 hover:text-muted-foreground flex w-full items-center justify-center py-1.5 transition-colors"
                title={`Show ${Math.min(LOAD_MORE_STEP, remainingCount)} more`}
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </>
    </div>
  );
}
