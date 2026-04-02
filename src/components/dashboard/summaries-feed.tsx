"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Inbox } from "@/lib/icons";
import { SummaryRow } from "@/components/dashboard/summary-row";
import { VideoInboxRow } from "@/components/dashboard/video-inbox-row";
import { LanguagePicker } from "@/components/dashboard/language-picker";
import { dialogManager } from "@/features/dialog-manager/dialog-manager";
import { toast } from "sonner";
import type {
  EnrichedDelivery,
  ProcessedVideo,
} from "@/components/dashboard/summary-row";

const PAGE_SIZE = 20;

type ChannelState = { active: boolean; subId: string };

type Props = {
  initialDeliveries?: EnrichedDelivery[];
  initialPreferredLang?: string;
  initialFavLangs?: string[];
  initialChannelStates?: Record<string, ChannelState>;
  headerRight?: React.ReactNode;
  banners?: React.ReactNode;
};

function SummaryRowSkeleton() {
  return (
    <div className="nm-raised animate-pulse overflow-hidden rounded-2xl">
      <div className="flex items-center gap-3 p-3">
        <div className="h-16 w-16 shrink-0 rounded-lg bg-white/[0.06] sm:h-[72px] sm:w-[72px]" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-3/4 rounded-full bg-white/[0.06]" />
          <div className="h-3 w-1/2 rounded-full bg-white/[0.06]" />
        </div>
      </div>
      <div className="px-3 pb-2.5">
        <div className="h-1.5 w-full rounded-full bg-white/[0.06]" />
      </div>
    </div>
  );
}

export function SummariesFeed({
  initialDeliveries = [],
  initialPreferredLang = "en",
  initialFavLangs = [],
  initialChannelStates = {},
  headerRight,
  banners,
}: Props) {
  const [feedMode, setFeedMode] = useState<"summaries" | "all">("summaries");
  const [deliveries, setDeliveries] =
    useState<EnrichedDelivery[]>(initialDeliveries);
  type InboxVideo = {
    video_id: string;
    channel_id: string;
    title: string;
    published_at: string;
    is_summarized: boolean;
    delivery_id: string | null;
    language: string | null;
    video?: ProcessedVideo;
  };
  const [inboxVideos, setInboxVideos] = useState<InboxVideo[]>([]);
  // Per-tab pagination state to preserve cache when switching tabs
  const [summariesLoading, setSummariesLoading] = useState(
    initialDeliveries.length === 0,
  );
  const [summariesHasMore, setSummariesHasMore] = useState(
    initialDeliveries.length === PAGE_SIZE,
  );
  const [summariesPage, setSummariesPage] = useState(0);

  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxHasMore, setInboxHasMore] = useState(true);
  const [inboxPage, setInboxPage] = useState(0);

  const loading = feedMode === "summaries" ? summariesLoading : inboxLoading;
  const hasMore = feedMode === "summaries" ? summariesHasMore : inboxHasMore;
  const _page = feedMode === "summaries" ? summariesPage : inboxPage;

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // IDs déjà tentés (succès ou échec) — évite de re-fetcher sur chaque update realtime
  const fetchedRef = useRef<Set<string>>(new Set());
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [favLangs, setFavLangs] = useState<string[]>(initialFavLangs);
  const [preferredLang, setPreferredLang] = useState(initialPreferredLang);
  const supabase = useMemo(() => createClient(), []);
  const [channelStates, setChannelStates] =
    useState<Record<string, ChannelState>>(initialChannelStates);

  const loadInboxVideos = useCallback(
    async (pageNum: number) => {
      setInboxLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const from = pageNum * PAGE_SIZE;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.rpc as any)("get_unified_feed", {
        p_user_id: user.id,
        p_limit: PAGE_SIZE,
        p_offset: from,
      });

      if (!data) {
        setInboxLoading(false);
        return;
      }

      const raw = data as unknown as InboxVideo[];
      // Fetch processed_videos for summarized items
      const summarizedIds = raw
        .filter((v) => v.is_summarized)
        .map((v) => v.video_id);
      const videoMap: Record<string, ProcessedVideo> = {};
      if (summarizedIds.length > 0) {
        const { data: videos } = await supabase
          .from("processed_videos")
          .select(
            "video_id, language, video_title, video_url, summary, audio_url, channel_id, status",
          )
          .in("video_id", summarizedIds);
        if (videos) {
          for (const v of videos) {
            videoMap[v.video_id] ??= v;
          }
        }
      }
      const enriched: InboxVideo[] = raw.map((v) => ({
        ...v,
        video: videoMap[v.video_id],
      }));
      setInboxHasMore(enriched.length === PAGE_SIZE);
      setInboxVideos((prev) =>
        pageNum === 0 ? enriched : [...prev, ...enriched],
      );
      setInboxPage(pageNum);
      setInboxLoading(false);
    },
    [supabase],
  );

  const loadDeliveries = useCallback(
    async (pageNum: number) => {
      setSummariesLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      if (pageNum === 0) {
        const [{ data: profile }, { data: subs }] = await Promise.all([
          supabase
            .from("profiles")
            .select("favorite_languages, preferred_language")
            .eq("id", user.id)
            .single(),
          supabase
            .from("subscriptions")
            .select("id, channel_id, active")
            .eq("user_id", user.id),
        ]);
        const pref = profile?.preferred_language ?? "en";
        setPreferredLang(pref);
        const langs = [
          ...new Set([...(profile?.favorite_languages ?? []), pref]),
        ];
        setFavLangs(langs);
        if (subs) {
          const map: Record<string, { active: boolean; subId: string }> = {};
          for (const s of subs) {
            map[s.channel_id] = { active: !!s.active, subId: s.id };
          }
          setChannelStates(map);
        }
      }

      const from = pageNum * PAGE_SIZE;

      const { data: deliveryData } = await supabase.rpc("get_feed_deliveries", {
        p_user_id: user.id,
        p_limit: PAGE_SIZE,
        p_offset: from,
      });

      if (!deliveryData) {
        setSummariesLoading(false);
        return;
      }

      setSummariesHasMore(deliveryData.length === PAGE_SIZE);

      const videoIds = [...new Set(deliveryData.map((d) => d.video_id))];

      const videoMap: Record<string, ProcessedVideo> = {};
      if (videoIds.length > 0) {
        // Select only the columns the card needs — skip summary/metadata/transcript fields
        // which are heavy (summary = long text, metadata = JSONB with description etc.)
        // Also filter by the languages present in these deliveries to avoid fetching
        // duplicate rows for other languages.
        const languages = [...new Set(deliveryData.map((d) => d.language))];
        const { data: videos } = await supabase
          .from("processed_videos")
          .select(
            "video_id, language, video_title, video_url, summary, audio_url, channel_id, status",
          )
          .in("video_id", videoIds)
          .in("language", languages);

        if (videos) {
          // Key by video_id:language for precise matching, fallback to video_id
          for (const v of videos) {
            videoMap[`${v.video_id}:${v.language}`] = v;
            videoMap[v.video_id] ??= v;
          }
        }
      }

      const enriched = deliveryData
        .map(
          (d) =>
            ({
              ...d,
              video:
                videoMap[`${d.video_id}:${d.language}`] ?? videoMap[d.video_id],
            }) as EnrichedDelivery,
        )
        // Only show deliveries with a completed video (audio available)
        .filter((d) => d.video?.audio_url);

      setDeliveries((prev) =>
        pageNum === 0 ? enriched : [...prev, ...enriched],
      );
      setSummariesPage(pageNum);
      setSummariesLoading(false);
    },
    [supabase],
  );

  useEffect(() => {
    if (initialDeliveries.length === 0) {
      void loadDeliveries(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load channel subscription states on mount (needed for Active/Paused badges)
  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: subs } = await supabase
        .from("subscriptions")
        .select("id, channel_id, active")
        .eq("user_id", user.id);
      if (subs) {
        const map: Record<string, { active: boolean; subId: string }> = {};
        for (const s of subs) {
          map[s.channel_id] = { active: !!s.active, subId: s.id };
        }
        setChannelStates(map);
      }
    })();
  }, [supabase]);

  // Load inbox when switching to "all" mode
  useEffect(() => {
    if (feedMode === "all" && inboxVideos.length === 0) {
      void loadInboxVideos(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedMode]);

  // Infinite scroll for both tabs
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || !hasMore || loading) return;
        if (feedMode === "summaries") {
          void loadDeliveries(summariesPage + 1);
        } else {
          void loadInboxVideos(inboxPage + 1);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [
    sentinelRef,
    hasMore,
    loading,
    feedMode,
    summariesPage,
    inboxPage,
    loadDeliveries,
    loadInboxVideos,
  ]);

  const toggleFavorite = useCallback(
    (code: string) => {
      const next = favLangs.includes(code)
        ? favLangs.filter((c) => c !== code)
        : [...favLangs, code];
      setFavLangs(next);
      void (async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        await supabase
          .from("profiles")
          .update({ favorite_languages: next })
          .eq("id", user.id);
      })();
    },
    [favLangs, supabase],
  );

  const openLangPicker = useCallback(() => {
    dialogManager.custom({
      title: "Favorite languages",
      size: "sm",
      children: (
        <LanguagePicker
          currentCode={preferredLang}
          favorites={favLangs}
          onSelect={(lang) => {
            dialogManager.closeAll();
            setPreferredLang(lang.code);
            void (async () => {
              const {
                data: { user },
              } = await supabase.auth.getUser();
              if (!user) return;
              await supabase
                .from("profiles")
                .update({ preferred_language: lang.code })
                .eq("id", user.id);
              toast.success("Language updated");
            })();
          }}
          onToggleFavorite={toggleFavorite}
        />
      ),
    });
  }, [toggleFavorite, favLangs, preferredLang, supabase]);

  // Promote a video to top when already in list, or re-fetch if not found
  useEffect(() => {
    const handler = (e: Event) => {
      const videoId = (e as CustomEvent<{ videoId: string }>).detail.videoId;
      if (!videoId) return;
      setDeliveries((prev) => {
        const idx = prev.findIndex((d) => d.video_id === videoId);
        if (idx > 0) {
          // Already in list — move to top instantly, no re-fetch needed
          const item = prev[idx];
          return [item, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
        }
        // Not in current page — trigger a full re-fetch
        void loadDeliveries(0);
        return prev;
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    window.addEventListener("summariesHighlight", handler);
    return () => window.removeEventListener("summariesHighlight", handler);
  }, [loadDeliveries]);

  // Realtime: update video status in-place when processed_videos changes
  // Wrapped in try-catch: WebSocket may be blocked by strict browsers or corporate networks
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel("processed-videos-status")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "processed_videos" },
          (payload) => {
            const updated = payload.new as ProcessedVideo;
            setDeliveries((prev) =>
              prev.map((d) =>
                d.video_id === updated.video_id ? { ...d, video: updated } : d,
              ),
            );
          },
        )
        .subscribe();
    } catch {
      // WebSocket unavailable — degrade gracefully, user can refresh manually
    }

    return () => {
      if (channel) void supabase.removeChannel(channel);
    };
  }, [supabase]);

  // Resolve missing titles via noembed API
  useEffect(() => {
    const missing = deliveries.filter(
      (d) =>
        !titles[d.video_id] &&
        !fetchedRef.current.has(d.video_id) &&
        // No title, or title is just the raw videoId (inserted without metadata)
        (!d.video?.video_title || d.video.video_title === d.video_id),
    );
    if (missing.length === 0) return;

    const ids = [...new Set(missing.map((d) => d.video_id))];
    // Marquer immédiatement comme tentés pour éviter les doublons (realtime, pagination)
    for (const id of ids) fetchedRef.current.add(id);

    const fetchTitle = async (videoId: string) => {
      const videoIdClean = videoId.replace(/[^a-zA-Z0-9_-]/g, "");
      if (!videoIdClean) return;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      try {
        const res = await fetch(
          `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoIdClean}`,
          { signal: controller.signal },
        );
        const data = (await res.json()) as { title?: string };
        if (data.title) {
          setTitles((prev) => ({ ...prev, [videoId]: data.title ?? "" }));
        }
      } catch {
        // Timeout ou erreur réseau — on ignore silencieusement
      } finally {
        clearTimeout(timer);
      }
    };

    void Promise.allSettled(ids.map(fetchTitle));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveries]);

  const toggleChannel = useCallback(
    async (channelId: string) => {
      const state = channelStates[channelId] as
        | { active: boolean; subId: string }
        | undefined;
      if (!state) return;
      const newActive = !state.active;
      setChannelStates((prev) => ({
        ...prev,
        [channelId]: { ...prev[channelId], active: newActive },
      }));
      await supabase
        .from("subscriptions")
        .update({ active: newActive, paused_by_system: false })
        .eq("id", state.subId);
      toast.success(newActive ? "Channel activated" : "Channel paused");
    },
    [channelStates, supabase],
  );

  const showEmpty =
    !loading &&
    (feedMode === "summaries"
      ? deliveries.length === 0
      : inboxVideos.length === 0);

  return (
    <div className="space-y-2.5">
      {/* Feed mode toggle + header actions */}
      <div className="sticky top-[57px] z-30 -mx-4 flex items-center justify-between border-b border-white/[0.06] bg-[oklch(0.13_0_0)] px-4 py-2 md:-mx-6 md:px-6">
        <div className="nm-raised flex rounded-full p-0.5">
          <button
            onClick={() => setFeedMode("summaries")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              feedMode === "summaries"
                ? "bg-red-600 text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Summaries
          </button>
          <button
            onClick={() => setFeedMode("all")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              feedMode === "all"
                ? "bg-red-600 text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All videos
          </button>
        </div>
        {headerRight && (
          <div className="flex items-center gap-1">{headerRight}</div>
        )}
      </div>

      {banners}

      {showEmpty ? (
        <div className="py-12 text-center">
          <div className="nm-inset mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl">
            <Inbox className="text-muted-foreground/50 h-4 w-4" />
          </div>
          <p className="text-sm font-medium">
            {feedMode === "summaries" ? "No summaries yet" : "No videos found"}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {feedMode === "summaries"
              ? "Add YouTube channels to receive your first audio summaries."
              : "Videos from your imported channels will appear here after the next scan."}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {feedMode === "summaries"
            ? deliveries
                .filter((d) => d.video?.audio_url)
                .map((delivery) => (
                  <SummaryRow
                    key={delivery.id}
                    delivery={delivery}
                    resolvedTitle={titles[delivery.video_id]}
                    favoriteLanguages={favLangs}
                    onManageFavorites={openLangPicker}
                    onToggleFavorite={toggleFavorite}
                    channelActive={
                      delivery.video?.channel_id
                        ? (
                            channelStates[delivery.video.channel_id] as
                              | { active: boolean }
                              | undefined
                          )?.active
                        : undefined
                    }
                    onToggleChannel={
                      delivery.video?.channel_id
                        ? () =>
                            void toggleChannel(delivery.video?.channel_id ?? "")
                        : undefined
                    }
                  />
                ))
            : inboxVideos.map((v) =>
                v.is_summarized && v.video ? (
                  <SummaryRow
                    key={v.video_id}
                    delivery={{
                      id: v.delivery_id ?? v.video_id,
                      video_id: v.video_id,
                      user_id: "",
                      status: "sent",
                      source: null,
                      sent_at: null,
                      created_at: v.published_at,
                      language: v.language ?? undefined,
                      video: v.video,
                    }}
                    resolvedTitle={v.title}
                    favoriteLanguages={favLangs}
                    onManageFavorites={openLangPicker}
                    onToggleFavorite={toggleFavorite}
                    channelActive={
                      (
                        channelStates[v.channel_id] as
                          | { active: boolean }
                          | undefined
                      )?.active
                    }
                    onToggleChannel={() => void toggleChannel(v.channel_id)}
                  />
                ) : (
                  <VideoInboxRow
                    key={v.video_id}
                    videoId={v.video_id}
                    channelId={v.channel_id}
                    title={v.title}
                    publishedAt={v.published_at}
                    onSummarized={() => void loadInboxVideos(0)}
                  />
                ),
              )}
          {loading &&
            (feedMode === "summaries"
              ? deliveries.length === 0
              : inboxVideos.length === 0) &&
            Array.from({ length: 3 }).map((_, i) => (
              <SummaryRowSkeleton key={i} />
            ))}
        </div>
      )}

      {hasMore && <div ref={sentinelRef} className="h-4" />}
    </div>
  );
}
