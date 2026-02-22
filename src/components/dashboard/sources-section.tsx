"use client";

import { useState } from "react";
import Image from "next/image";
import { useQueryState } from "nuqs";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Youtube,
  Pause,
  Play,
  Trash2,
  ChevronDown,
  ListFilter,
} from "@/lib/icons";
import { dialogManager } from "@/features/dialog-manager/dialog-manager";
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
  onToggle,
  onRemove,
  searchQuery,
}: {
  source: Subscription;
  onToggle: (source: Subscription) => void;
  onRemove: (id: string, name: string) => void;
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
      className={`group flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-white/[0.02] ${
        !source.active ? "opacity-40" : ""
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        {source.channel_avatar_url ? (
          <Image
            src={source.channel_avatar_url}
            alt={source.channel_name}
            width={32}
            height={32}
            className="h-8 w-8 shrink-0 rounded-full"
            suppressHydrationWarning
          />
        ) : (
          <div className="bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
            {source.channel_name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{nameEl}</p>
          <a
            href={`https://www.youtube.com/channel/${source.channel_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground/60 hover:text-muted-foreground text-[11px] transition-colors"
          >
            YouTube
          </a>
        </div>
      </div>

      <div className="ml-2 flex shrink-0 items-center gap-1">
        <button
          onClick={() => onToggle(source)}
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
            source.active
              ? "text-muted-foreground/50 hover:text-muted-foreground hover:bg-white/[0.06]"
              : "text-muted-foreground/25 hover:text-muted-foreground/60 hover:bg-white/[0.06]"
          }`}
          title={source.active ? "Pause summaries" : "Activate summaries"}
        >
          {source.active ? (
            <Pause className="h-3.5 w-3.5" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          className="text-muted-foreground/25 flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-red-500/10 hover:text-red-400"
          onClick={() => onRemove(source.id, source.channel_name)}
          title="Remove channel"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function SourcesSection({ initialSources, maxChannels, isPro }: Props) {
  const [sources, setSources] = useState<Subscription[]>(initialSources);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [collapsed, setCollapsed] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "paused">(
    "all",
  );
  const [q] = useQueryState("q", { defaultValue: "", shallow: true });
  const supabase = createClient();

  const activeCount = sources.filter((s) => s.active).length;
  const atActiveLimit = !isPro && activeCount >= maxChannels;

  // Ignore YouTube URLs in the search filter (they're handled by ChannelSearchBar)
  const isYouTubeQ =
    q.includes("youtube.com") ||
    q.includes("youtu.be") ||
    q.startsWith("@") ||
    /^UC[\w-]{10,}$/.test(q);
  const searchNorm = q.trim().length > 0 && !isYouTubeQ ? q.toLowerCase() : "";

  // Active first, then paused — preserving insertion order within each group
  const sortedSources = [
    ...sources.filter((s) => s.active),
    ...sources.filter((s) => !s.active),
  ];

  const filteredByStatus =
    filterStatus === "all"
      ? sortedSources
      : sortedSources.filter((s) =>
          filterStatus === "active" ? s.active : !s.active,
        );

  const displayedSources = searchNorm
    ? filteredByStatus.filter((s) =>
        s.channel_name.toLowerCase().includes(searchNorm),
      )
    : filteredByStatus.slice(0, visibleCount);

  const remainingCount = filteredByStatus.length - visibleCount;
  const hasMore = !searchNorm && visibleCount < filteredByStatus.length;

  const toggleActive = async (source: Subscription) => {
    const newActive = !source.active;

    if (newActive && atActiveLimit) {
      dialogManager.confirm({
        title: "Upgrade to Pro",
        description: `You've reached the limit of ${maxChannels} active channels. Upgrade to Pro for unlimited active channels.`,
        variant: "default",
        action: {
          label: "Upgrade to Pro",
          onClick: async () => {
            window.location.href = "/dashboard/billing";
          },
        },
      });
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

  const removeSource = (id: string, name: string) => {
    dialogManager.confirm({
      title: "Remove source",
      description: `Remove "${name}" from your sources?`,
      variant: "destructive",
      action: {
        label: "Remove",
        onClick: async () => {
          const { error } = await supabase
            .from("subscriptions")
            .delete()
            .eq("id", id);
          if (error) {
            toast.error("Failed to remove source");
            return;
          }
          setSources((prev) => prev.filter((s) => s.id !== id));
          toast.success("Source removed");
        },
      },
    });
  };

  const rowProps = {
    onToggle: toggleActive,
    onRemove: removeSource,
    searchQuery: searchNorm,
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-2"
        >
          <h2 className="text-sm font-semibold">Sources</h2>
          <span className="text-muted-foreground/50 text-xs tabular-nums">
            {isPro ? sources.length : `${activeCount}/${maxChannels}`}
          </span>
          <ChevronDown
            className={`text-muted-foreground/40 h-3.5 w-3.5 transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`}
          />
        </button>
        <button
          onClick={() => setShowFilter((f) => !f)}
          title="Filter"
          className={`flex h-6 w-6 items-center justify-center rounded transition-colors ${
            showFilter || filterStatus !== "all"
              ? "nm-inset-sm text-foreground"
              : "text-muted-foreground/40 hover:text-muted-foreground hover:bg-white/[0.04]"
          }`}
        >
          <ListFilter className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Filter pills */}
      {showFilter && !collapsed && (
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
      )}

      {!collapsed && (
        <>
          {/* Import from YouTube */}
          <a
            href="/api/youtube/auth"
            className="text-muted-foreground/60 hover:text-muted-foreground flex w-fit items-center gap-1.5 text-xs transition-colors"
          >
            <Youtube className="h-3.5 w-3.5" />
            Import subscriptions from YouTube
          </a>

          {/* Active limit banner */}
          {atActiveLimit && (
            <div className="nm-raised rounded-2xl bg-amber-500/[0.05] px-4 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {maxChannels} active channels reached
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Pause a channel to swap, or upgrade to Pro for unlimited.
                  </p>
                </div>
                <Button
                  size="sm"
                  className="shrink-0 bg-red-600 hover:bg-red-500"
                  asChild
                >
                  <a href="/dashboard/billing">Upgrade to Pro</a>
                </Button>
              </div>
            </div>
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
              {/* Channel list */}
              <div className="nm-raised overflow-hidden rounded-2xl">
                {displayedSources.length > 0 ? (
                  <div className="divide-y divide-white/[0.04]">
                    {displayedSources.map((source) => (
                      <SourceRow
                        key={source.id}
                        source={source}
                        {...rowProps}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground px-4 py-6 text-center text-sm">
                    No channel matching &ldquo;{q}&rdquo;
                  </p>
                )}
              </div>

              {/* Show more */}
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
      )}
    </div>
  );
}
