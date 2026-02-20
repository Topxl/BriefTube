"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Loader2, Youtube, Play, Pause, Search, X } from "lucide-react";
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
  atActiveLimit,
  onToggle,
  onRemove,
  searchQuery,
}: {
  source: Subscription;
  atActiveLimit: boolean;
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
          <mark className="rounded-sm bg-yellow-400/20 text-yellow-300">
            {name.slice(idx, idx + q.length)}
          </mark>
          {name.slice(idx + q.length)}
        </>
      );
    }
  }

  return (
    <div
      className={`flex items-center justify-between px-3 py-2.5 transition-colors hover:bg-white/[0.02] sm:px-4 sm:py-3 ${
        !source.active ? "opacity-50" : ""
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
          />
        ) : (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-xs font-bold text-red-400">
            {source.channel_name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{nameEl}</p>
          <a
            href={`https://www.youtube.com/channel/${source.channel_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground text-[11px] transition-colors"
          >
            YouTube →
          </a>
        </div>
      </div>

      <div className="ml-2 flex shrink-0 items-center gap-1">
        <button
          onClick={() => onToggle(source)}
          className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
            source.active
              ? "text-emerald-400 hover:bg-emerald-500/10"
              : atActiveLimit
                ? "text-muted-foreground hover:text-amber-400"
                : "text-muted-foreground hover:text-emerald-400"
          }`}
          title={source.active ? "Pause summaries" : "Activate summaries"}
        >
          {source.active ? (
            <>
              <Pause className="h-3 w-3" />
              Active
            </>
          ) : (
            <>
              <Play className="h-3 w-3" />
              Paused
            </>
          )}
        </button>
        <button
          className="text-muted-foreground ml-1 shrink-0 px-2 py-1 text-xs transition-colors hover:text-red-400"
          onClick={() => onRemove(source.id, source.channel_name)}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

export function SourcesSection({ initialSources, maxChannels, isPro }: Props) {
  const [sources, setSources] = useState<Subscription[]>(initialSources);
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const supabase = createClient();

  const activeCount = sources.filter((s) => s.active).length;
  const atActiveLimit = !isPro && activeCount >= maxChannels;

  // Active first, then paused — preserving insertion order within each group
  const sortedSources = [
    ...sources.filter((s) => s.active),
    ...sources.filter((s) => !s.active),
  ];

  const searchNorm = search.trim().toLowerCase();
  const displayedSources = searchNorm
    ? sortedSources.filter((s) =>
        s.channel_name.toLowerCase().includes(searchNorm),
      )
    : sortedSources.slice(0, visibleCount);

  const remainingCount = sources.length - visibleCount;
  const hasMore = !searchNorm && visibleCount < sources.length;

  const addSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setAdding(true);
    setAddError("");
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json()) as Subscription & { error?: string };
      if (!res.ok) {
        setAddError(data.error ?? "Failed to add channel");
        return;
      }
      setSources((prev) => [data, ...prev]);
      setSearch("");
      setVisibleCount(INITIAL_VISIBLE);
      setUrl("");
      toast.success(
        data.active
          ? "Source added and active"
          : "Source added (paused — active limit reached)",
      );
    } catch {
      setAddError("Something went wrong");
    } finally {
      setAdding(false);
    }
  };

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
    atActiveLimit,
    onToggle: toggleActive,
    onRemove: removeSource,
    searchQuery: search,
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Sources</h2>
          <p className="text-muted-foreground text-xs">
            {isPro
              ? `${sources.length} sources`
              : `${activeCount} of ${maxChannels} active · ${sources.length} total`}
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href="/api/youtube/auth">
            <Youtube className="h-3.5 w-3.5" />
            Import
          </a>
        </Button>
      </div>

      {/* Add form */}
      <form onSubmit={(e) => void addSource(e)} className="flex gap-2">
        <Input
          type="text"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setAddError("");
          }}
          placeholder="youtube.com/@channel or channel ID"
          className="flex-1"
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          data-form-type="other"
        />
        <Button
          type="submit"
          disabled={adding || !url.trim()}
          className="shrink-0 bg-red-600 shadow-[0_0_12px_rgba(239,68,68,0.15)] hover:bg-red-500"
        >
          {adding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </Button>
      </form>

      {addError && <p className="text-xs text-red-400">{addError}</p>}

      {/* Active limit banner */}
      {atActiveLimit && (
        <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] px-4 py-3">
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
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03]">
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
          {/* Search bar — visible when there are more channels than the initial limit */}
          {sources.length > INITIAL_VISIBLE && (
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
              <Input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${sources.length} channels...`}
                className="pr-8 pl-8 text-sm"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Channel list */}
          <div className="overflow-hidden rounded-xl border border-white/[0.06]">
            {displayedSources.length > 0 ? (
              <div className="divide-y divide-white/[0.04]">
                {displayedSources.map((source) => (
                  <SourceRow key={source.id} source={source} {...rowProps} />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground px-4 py-6 text-center text-sm">
                No channel matching &ldquo;{search}&rdquo;
              </p>
            )}
          </div>

          {/* Show more */}
          {hasMore && (
            <button
              onClick={() => setVisibleCount((n) => n + LOAD_MORE_STEP)}
              className="text-muted-foreground hover:text-foreground w-full rounded-xl border border-white/[0.06] bg-white/[0.01] py-2.5 text-xs transition-colors hover:bg-white/[0.03]"
            >
              Show {Math.min(LOAD_MORE_STEP, remainingCount)} more ·{" "}
              {remainingCount} remaining
            </button>
          )}
        </div>
      )}
    </div>
  );
}
