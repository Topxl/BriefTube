"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Inbox } from "@/lib/icons";
import { SummaryRow } from "@/components/dashboard/summary-row";
import { t } from "@/locales";
import type {
  EnrichedDelivery,
  ProcessedVideo,
} from "@/components/dashboard/summary-row";

const tl = t.dashboard.summaries;

const PAGE_SIZE = 20;

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

export function SummariesFeed() {
  const [deliveries, setDeliveries] = useState<EnrichedDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const supabase = useMemo(() => createClient(), []);

  const loadDeliveries = useCallback(
    async (pageNum: number) => {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: deliveryData } = await supabase
        .from("deliveries")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (!deliveryData) {
        setLoading(false);
        return;
      }

      setHasMore(deliveryData.length === PAGE_SIZE);

      const videoIds = [...new Set(deliveryData.map((d) => d.video_id))];

      let videoMap: Record<string, ProcessedVideo> = {};
      if (videoIds.length > 0) {
        const { data: videos } = await supabase
          .from("processed_videos")
          .select("*")
          .in("video_id", videoIds);

        if (videos) {
          videoMap = Object.fromEntries(videos.map((v) => [v.video_id, v]));
        }
      }

      const enriched: EnrichedDelivery[] = deliveryData.map((d) => ({
        ...d,
        video: videoMap[d.video_id],
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
    void loadDeliveries(0);
  }, [loadDeliveries]);

  // Realtime: update video status in-place when processed_videos changes
  useEffect(() => {
    const channel = supabase
      .channel("processed-videos-status")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "processed_videos" },
        (payload) => {
          const updated = payload.new as ProcessedVideo;
          setDeliveries((prev) =>
            prev.map((d) =>
              d.video_id === updated.video_id
                ? { ...d, video: updated }
                : d,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  // Resolve missing titles via noembed API
  useEffect(() => {
    const missing = deliveries.filter(
      (d) =>
        !titles[d.video_id] &&
        // No title, or title is just the raw videoId (inserted without metadata)
        (!d.video?.video_title || d.video.video_title === d.video_id),
    );
    if (missing.length === 0) return;

    const ids = [...new Set(missing.map((d) => d.video_id))];
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
        <p className="text-sm font-medium">Aucun résumé pour l'instant</p>
        <p className="text-muted-foreground mt-1 text-xs">
          Ajoutez des chaînes YouTube pour recevoir vos premiers résumés audio.
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
          />
        ))}
        {loading &&
          Array.from({ length: 3 }).map((_, i) => (
            <SummaryRowSkeleton key={i} />
          ))}
      </div>

      {hasMore && !loading && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => loadDeliveries(page + 1)}
          >
            {tl.loadMore}
          </Button>
        </div>
      )}
    </div>
  );
}
