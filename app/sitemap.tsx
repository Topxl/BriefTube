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
        .select("channel_id, created_at")
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);

  const allChannelIds = new Set((channelRows ?? []).map((r) => r.channel_id));

  // Index of last summary date per channel
  const lastSummaryByChannel = (lastVideos ?? []).reduce<
    Record<string, string>
  >((acc, v) => {
    if (!acc[v.channel_id] && v.created_at) {
      acc[v.channel_id] = v.created_at;
    }
    return acc;
  }, {});

  return [
    {
      url: `${SiteConfig.prodUrl}`,
      lastModified: new Date("2026-02-24"),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SiteConfig.prodUrl}/pricing`,
      lastModified: new Date("2026-02-24"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SiteConfig.prodUrl}/privacy`,
      lastModified: new Date("2026-02-18"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SiteConfig.prodUrl}/terms`,
      lastModified: new Date("2026-02-18"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SiteConfig.prodUrl}/support`,
      lastModified: new Date("2026-02-18"),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    // Blog
    {
      url: `${SiteConfig.prodUrl}/blog`,
      lastModified: new Date("2026-02-24"),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    ...articles.map((article) => ({
      url: `${SiteConfig.prodUrl}/blog/${article.slug}`,
      lastModified: new Date(article.date),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    // Comparisons
    {
      url: `${SiteConfig.prodUrl}/vs`,
      lastModified: new Date("2026-02-24"),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    ...comparisons.map((comp) => ({
      url: `${SiteConfig.prodUrl}/vs/${comp.slug}`,
      lastModified: new Date(comp.lastUpdated),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    // Public lists
    ...(publicLists ?? []).map((list) => ({
      url: `${SiteConfig.prodUrl}/lists/${list.id}`,
      lastModified: new Date(list.created_at ?? Date.now()),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    // Channel index
    {
      url: `${SiteConfig.prodUrl}/channels`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.7,
    },
    // Programmatic channel pages — only channels with at least one completed summary
    ...Object.keys(lastSummaryByChannel)
      .filter((channelId) => allChannelIds.has(channelId))
      .map((channelId) => ({
        url: `${SiteConfig.prodUrl}/channels/${channelId}`,
        lastModified: new Date(lastSummaryByChannel[channelId]),
        changeFrequency: "daily" as const,
        priority: 0.5,
      })),
  ];
}
