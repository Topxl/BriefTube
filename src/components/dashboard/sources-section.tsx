"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Search,
  Trash2,
  TriangleAlertIcon,
  X,
  Loader2,
  Play,
  Check,
  Youtube,
} from "@/lib/icons";
import { dialogManager } from "@/features/dialog-manager/dialog-manager";
import { openUpsellModal } from "@/components/dashboard/upsell-modal";
import { Banner } from "@/components/nowts/banner";
import { addProcessingVideo } from "@/lib/processing-videos";
import { extractVideoId } from "@/lib/youtube-id";
import type { Tables } from "@/types/supabase";

type Subscription = Tables<"subscriptions">;

const INITIAL_VISIBLE = 20;
const LOAD_MORE_STEP = 10;

function isYouTubeInput(val: string): boolean {
  const v = val.trim();
  return (
    v.includes("youtube.com") ||
    v.includes("youtu.be") ||
    v.startsWith("@") ||
    /^UC[\w-]{10,}$/.test(v)
  );
}

type LinkPreview = {
  type: "video" | "channel";
  videoId?: string;
  title?: string;
  channelName: string;
  channelId: string;
  thumbnail?: string;
  isSubscribed: boolean;
};

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
  const [imgError, setImgError] = useState(false);
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
      <button
        onClick={() => onSelect(source.id)}
        aria-label={selected ? "Deselect" : "Select"}
        className="relative shrink-0 cursor-pointer rounded-full transition-all"
      >
        {source.channel_avatar_url && !imgError ? (
          <Image
            src={source.channel_avatar_url}
            alt={source.channel_name}
            width={32}
            height={32}
            className={`h-8 w-8 rounded-full transition-all ${
              !source.active && !selected ? "opacity-35" : ""
            } ${selected ? "opacity-50" : ""}`}
            onError={() => setImgError(true)}
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
        {selected ? (
          <span className="bg-foreground/80 text-background absolute inset-0 flex items-center justify-center rounded-full text-[11px] font-bold">
            ✓
          </span>
        ) : (
          <span className="absolute inset-0 rounded-full bg-white/0 transition-colors group-hover:bg-white/10" />
        )}
      </button>

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
  const router = useRouter();
  const [sources, setSources] = useState<Subscription[]>(initialSources);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "paused">(
    "all",
  );
  const [searchInput, setSearchInput] = useState("");
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisibleCount((n) => n + LOAD_MORE_STEP);
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [sentinelRef]);

  const trimmed = searchInput.trim();
  const isYT = trimmed.length > 0 && isYouTubeInput(trimmed);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!isYT) {
      setPreview(null);
      setLoadingPreview(false);
      return;
    }
    const instantVideoId = extractVideoId(trimmed);
    if (instantVideoId) {
      setPreview((prev) =>
        prev?.videoId === instantVideoId
          ? prev
          : {
              type: "video",
              videoId: instantVideoId,
              thumbnail: `https://img.youtube.com/vi/${instantVideoId}/mqdefault.jpg`,
              channelName: "",
              channelId: "",
              isSubscribed: false,
            },
      );
    }
    setLoadingPreview(true);
    debounceRef.current = setTimeout(() => {
      fetch(`/api/link-preview?url=${encodeURIComponent(trimmed)}`)
        .then(async (r) => r.json() as Promise<LinkPreview>)
        .then((data) => {
          setPreview(data);
          setLoadingPreview(false);
        })
        .catch(() => {
          setLoadingPreview(false);
        });
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [trimmed, isYT]);

  const handleSubscribe = async () => {
    if (!preview) return;
    setSubscribing(true);
    try {
      const payload = preview.channelId
        ? {
            channelId: preview.channelId,
            channelName: preview.channelName,
            videoId: preview.videoId,
            videoTitle: preview.title,
          }
        : { url: trimmed };
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        active?: boolean;
        error?: string;
        videoId?: string | null;
        videoTitle?: string | null;
      };
      if (!res.ok) {
        toast.error(data.error ?? "Failed to add channel");
        return;
      }
      if (data.active) {
        toast.success("Channel added");
      } else {
        openUpsellModal();
        toast.info("Channel added but paused — upgrade to activate it");
      }
      setPreview((p) => (p ? { ...p, isSubscribed: true } : p));
      if (data.videoId) {
        addProcessingVideo({
          videoId: data.videoId,
          title: data.videoTitle ?? data.videoId,
          startedAt: Date.now(),
        });
      }
      setSearchInput("");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubscribing(false);
    }
  };

  const handleSummarize = async () => {
    if (!preview?.videoId) return;
    setSummarizing(true);
    try {
      const res = await fetch("/api/process-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: preview.videoId,
          videoTitle: preview.title,
        }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        toast.error(d.error ?? "Failed");
        return;
      }
      const data = (await res.json()) as { queued?: boolean };
      if (data.queued) {
        addProcessingVideo({
          videoId: preview.videoId,
          title: preview.title ?? preview.videoId,
          startedAt: Date.now(),
        });
      } else {
        window.dispatchEvent(
          new CustomEvent("summariesHighlight", {
            detail: { videoId: preview.videoId },
          }),
        );
      }
      setSearchInput("");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSummarizing(false);
    }
  };

  const [displayedIds] = useState<string[]>(() => [
    ...initialSources.filter((s) => s.active).map((s) => s.id),
    ...initialSources.filter((s) => !s.active).map((s) => s.id),
  ]);

  const activeCount = sources.filter((s) => s.active).length;
  const atActiveLimit = !isPro && activeCount >= maxChannels;
  const searchNorm = !isYT ? trimmed.toLowerCase() : "";

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
      title: "Remove channels",
      description: `Remove ${count} channel${count > 1 ? "s" : ""} from your list?`,
      variant: "destructive",
      action: {
        label: `Remove ${count}`,
        onClick: async () => {
          const { error } = await supabase
            .from("subscriptions")
            .delete()
            .in("id", ids);
          if (error) {
            toast.error("Failed to remove channels");
            return;
          }
          setSources((prev) => prev.filter((s) => !selectedIds.has(s.id)));
          setSelectedIds(new Set());
          toast.success(`${count} channel${count > 1 ? "s" : ""} removed`);
        },
      },
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      {/* Unified search / add input */}
      <div className="relative">
        {isYT ? (
          <Youtube className="text-muted-foreground/40 absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
        ) : (
          <Search className="text-muted-foreground/40 absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
        )}
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search or paste a YouTube URL / @handle…"
          className="nm-inset text-foreground placeholder:text-muted-foreground/40 w-full rounded-full py-2 pr-8 pl-8 text-sm outline-none"
        />
        {searchInput && (
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              setPreview(null);
            }}
            className="text-muted-foreground/40 hover:text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* YouTube preview card */}
      {isYT && (loadingPreview || preview) && (
        <div className="nm-inset-sm rounded-xl bg-[oklch(0.18_0_0)] p-3">
          {preview ? (
            <div className="flex items-start gap-3">
              {preview.thumbnail ? (
                <img
                  src={preview.thumbnail}
                  alt={preview.title ?? preview.channelName}
                  className="h-14 w-24 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="nm-raised-sm flex h-14 w-14 shrink-0 items-center justify-center rounded-lg">
                  <Youtube className="text-muted-foreground h-5 w-5" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                {preview.title ? (
                  <p className="line-clamp-2 text-xs font-medium">
                    {preview.title}
                  </p>
                ) : (
                  <div className="bg-muted/50 mb-1 h-3 w-3/4 animate-pulse rounded" />
                )}
                {preview.channelName ? (
                  <p className="text-muted-foreground text-[11px]">
                    {preview.channelName}
                  </p>
                ) : (
                  <div className="bg-muted/50 h-2.5 w-1/2 animate-pulse rounded" />
                )}
                <div className="mt-2 flex gap-2">
                  {!preview.isSubscribed && (
                    <button
                      onClick={() => void handleSubscribe()}
                      disabled={subscribing || summarizing}
                      className="nm-raised-sm text-muted-foreground hover:text-foreground flex items-center gap-1 rounded-full px-3 py-1 text-xs transition-all disabled:opacity-50"
                    >
                      {subscribing && (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      )}
                      Subscribe
                    </button>
                  )}
                  {preview.isSubscribed && (
                    <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                      <Check className="h-3 w-3" /> Subscribed
                    </span>
                  )}
                  {preview.type === "video" && (
                    <button
                      onClick={() => void handleSummarize()}
                      disabled={subscribing || summarizing}
                      className="nm-raised-sm flex items-center gap-1 rounded-full bg-red-600/10 px-3 py-1 text-xs text-red-400 transition-all hover:bg-red-600/20 disabled:opacity-50"
                    >
                      {summarizing ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                      Summarize
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 py-1">
              <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
              <span className="text-muted-foreground text-xs">Loading…</span>
            </div>
          )}
        </div>
      )}

      {/* Toolbar: filter tabs OR selection controls */}
      {sources.length > 0 && !isYT && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground/50 text-xs tabular-nums">
              {isPro
                ? `${sources.length} channels`
                : `${activeCount}/${maxChannels} active`}
            </span>
            <a
              href="/api/youtube/auth"
              className="nm-raised-sm text-muted-foreground/60 hover:text-foreground flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium capitalize transition-colors"
            >
              <Youtube className="h-3 w-3" />
              Import
            </a>
          </div>
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
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
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
        </div>
      )}

      {/* Active limit banner */}
      {atActiveLimit && (
        <Banner
          variant="warning"
          icon={<TriangleAlertIcon className="h-3.5 w-3.5 text-amber-300/70" />}
          title={`${maxChannels} channels reached`}
          description="Pause a channel to swap, or upgrade to Pro for unlimited."
          action={{ label: "Upgrade", onClick: () => openUpsellModal() }}
        />
      )}

      {/* Channel list */}
      {sources.length === 0 ? (
        <div className="py-10 text-center">
          <div className="nm-inset mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl">
            <Youtube className="text-muted-foreground h-5 w-5" />
          </div>
          <p className="text-sm font-medium">No channels yet</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Paste a YouTube URL or @handle above to add one.
          </p>
        </div>
      ) : !isYT ? (
        <div className="flex flex-col gap-2">
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
                No channel matching &ldquo;{searchInput}&rdquo;
              </p>
            )}
          </div>
          {hasMore && <div ref={sentinelRef} className="h-4" />}
        </div>
      ) : null}
    </div>
  );
}
