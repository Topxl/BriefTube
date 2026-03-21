import type { MetadataRoute } from "next";
import { SiteConfig } from "@/site-config";
import { createAdminClient } from "@/lib/supabase/server";
import { articles } from "@/content/blog";
import { comparisons } from "@/content/comparisons";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createAdminClient();
  const [{ data: publicLists }, { data: channelRows }, { data: lastVideos }] =
    await Promise.all([
      supabase
        .from("channel_lists")
        .select("id, created_at")
        .eq("is_public", true),
      supabase
        .from("subscriptions")
        .select("channel_id")
        .eq("active", true)
        .limit(500),
      supabase
        .from("processed_videos")
        .select("video_id, channel_id, created_at")
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(300),
    ]);

  const allChannelIds = new Set((channelRows ?? []).map((r) => r.channel_id));

  // Deduplicate videos by video_id — processed_videos has one row per (video_id, language)
  const seenVideoIds = new Set<string>();
  const uniqueVideos = (lastVideos ?? []).filter((v) => {
    if (!v.video_id || seenVideoIds.has(v.video_id)) return false;
    seenVideoIds.add(v.video_id);
    return true;
  });

  // Index of last summary date per channel
  const lastSummaryByChannel = uniqueVideos.reduce<Record<string, string>>(
    (acc, v) => {
      if (!acc[v.channel_id] && v.created_at) {
        acc[v.channel_id] = v.created_at;
      }
      return acc;
    },
    {},
  );

  return [
    {
      url: `${SiteConfig.prodUrl}`,
      lastModified: new Date("2026-03-22"),
    },
    {
      url: `${SiteConfig.prodUrl}/pricing`,
      lastModified: new Date("2026-03-16"),
    },
    {
      url: `${SiteConfig.prodUrl}/privacy`,
      lastModified: new Date("2026-03-16"),
    },
    {
      url: `${SiteConfig.prodUrl}/terms`,
      lastModified: new Date("2026-03-16"),
    },
    {
      url: `${SiteConfig.prodUrl}/support`,
      lastModified: new Date("2026-03-16"),
    },
    // Blog
    {
      url: `${SiteConfig.prodUrl}/blog`,
      lastModified: new Date("2026-03-16"),
    },
    ...articles.map((article) => ({
      url: `${SiteConfig.prodUrl}/blog/${article.slug}`,
      lastModified: new Date(article.date),
    })),
    // Comparisons
    {
      url: `${SiteConfig.prodUrl}/vs`,
      lastModified: new Date("2026-03-16"),
    },
    ...comparisons.map((comp) => ({
      url: `${SiteConfig.prodUrl}/vs/${comp.slug}`,
      lastModified: new Date(comp.lastUpdated),
    })),
    // Lists index
    {
      url: `${SiteConfig.prodUrl}/lists`,
      lastModified: new Date("2026-03-22"),
    },
    // Public lists
    ...(publicLists ?? []).map((list) => ({
      url: `${SiteConfig.prodUrl}/lists/${list.id}`,
      lastModified: new Date(list.created_at ?? Date.now()),
    })),
    // Channel index
    {
      url: `${SiteConfig.prodUrl}/channels`,
      lastModified: new Date("2026-03-22"),
    },
    // Programmatic channel pages — only channels with at least one completed summary
    ...Object.keys(lastSummaryByChannel)
      .filter((channelId) => allChannelIds.has(channelId))
      .map((channelId) => ({
        url: `${SiteConfig.prodUrl}/channels/${channelId}`,
        lastModified: new Date(lastSummaryByChannel[channelId]),
      })),
    // Programmatic video summary pages
    ...uniqueVideos.map((v) => ({
      url: `${SiteConfig.prodUrl}/videos/${v.video_id}`,
      lastModified: new Date(v.created_at ?? Date.now()),
    })),
  ];
}
