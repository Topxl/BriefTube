"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Inbox } from "@/lib/icons";
import { SummaryRow } from "@/components/dashboard/summary-row";
import { LanguagePicker } from "@/components/dashboard/language-picker";
import { dialogManager } from "@/features/dialog-manager/dialog-manager";
import { toast } from "sonner";
import type {
  EnrichedDelivery,
  ProcessedVideo,
} from "@/components/dashboard/summary-row";

const PAGE_SIZE = 20;

type Props = {
  initialDeliveries?: EnrichedDelivery[];
  initialPreferredLang?: string;
  initialFavLangs?: string[];
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
}: Props) {
  const [deliveries, setDeliveries] =
    useState<EnrichedDelivery[]>(initialDeliveries);
  const [loading, setLoading] = useState(initialDeliveries.length === 0);
  const [hasMore, setHasMore] = useState(
    initialDeliveries.length === PAGE_SIZE,
  );
  const [page, setPage] = useState(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // IDs déjà tentés (succès ou échec) — évite de re-fetcher sur chaque update realtime
  const fetchedRef = useRef<Set<string>>(new Set());
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [favLangs, setFavLangs] = useState<string[]>(initialFavLangs);
  const [preferredLang, setPreferredLang] = useState(initialPreferredLang);
  const supabase = useMemo(() => createClient(), []);

  const loadDeliveries = useCallback(
    async (pageNum: number) => {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      if (pageNum === 0) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("favorite_languages, preferred_language")
          .eq("id", user.id)
          .single();
        const pref = profile?.preferred_language ?? "en";
        setPreferredLang(pref);
        const langs = [
          ...new Set([...(profile?.favorite_languages ?? []), pref]),
        ];
        setFavLangs(langs);
      }

      const from = pageNum * PAGE_SIZE;

      const { data: deliveryData } = await supabase.rpc("get_feed_deliveries", {
        p_user_id: user.id,
        p_limit: PAGE_SIZE,
        p_offset: from,
      });

      if (!deliveryData) {
        setLoading(false);
        return;
      }

      setHasMore(deliveryData.length === PAGE_SIZE);

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

      const enriched: EnrichedDelivery[] = deliveryData.map((d) => ({
        ...d,
        video: videoMap[`${d.video_id}:${d.language}`] ?? videoMap[d.video_id],
      }));

      setDeliveries((prev) =>
        pageNum === 0 ? enriched : [...prev, ...enriched],
      );
      setPage(pageNum);
      setLoading(false);
    },
    [supabase],
  );

  useEffect(() => {
    if (initialDeliveries.length === 0) {
      void loadDeliveries(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadDeliveries]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loading)
          void loadDeliveries(page + 1);
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [sentinelRef, hasMore, loading, page, loadDeliveries]);

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

  if (!loading && deliveries.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="nm-inset mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl">
          <Inbox className="text-muted-foreground/50 h-4 w-4" />
        </div>
        <p className="text-sm font-medium">No summaries yet</p>
        <p className="text-muted-foreground mt-1 text-xs">
          Add YouTube channels to receive your first audio summaries.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="space-y-2.5">
        {deliveries.map((delivery) => (
          <SummaryRow
            key={delivery.id}
            delivery={delivery}
            resolvedTitle={titles[delivery.video_id]}
            favoriteLanguages={favLangs}
            onManageFavorites={openLangPicker}
            onToggleFavorite={toggleFavorite}
          />
        ))}
        {loading &&
          Array.from({ length: 3 }).map((_, i) => (
            <SummaryRowSkeleton key={i} />
          ))}
      </div>

      {hasMore && <div ref={sentinelRef} className="h-4" />}
    </div>
  );
}
