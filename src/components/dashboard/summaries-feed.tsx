"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { SummaryRow } from "@/components/dashboard/summary-row";
import { t } from "@/locales";
import type {
  EnrichedDelivery,
  ProcessedVideo,
} from "@/components/dashboard/summary-row";

const tl = t.dashboard.summaries;

const PAGE_SIZE = 20;

export function SummariesFeed() {
  const [deliveries, setDeliveries] = useState<EnrichedDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const supabase = createClient();

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

  // Resolve missing titles via noembed API
  useEffect(() => {
    const missing = deliveries.filter(
      (d) => !d.video?.video_title && !titles[d.video_id],
    );
    if (missing.length === 0) return;

    const ids = [...new Set(missing.map((d) => d.video_id))];
    const fetchTitle = async (videoId: string) => {
      const videoIdClean = videoId.replace(/[^a-zA-Z0-9_-]/g, "");
      if (!videoIdClean) return;
      const res = await fetch(
        `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoIdClean}`,
      );
      const data = (await res.json()) as { title?: string };
      if (data.title) {
        setTitles((prev) => ({ ...prev, [videoId]: data.title ?? "" }));
      }
    };

    void Promise.allSettled(ids.map(fetchTitle));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveries]);

  if (!loading && deliveries.length === 0) {
    return null;
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
      </div>

      {loading && (
        <p className="text-muted-foreground py-3 text-center text-xs">
          {tl.loading}
        </p>
      )}

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
