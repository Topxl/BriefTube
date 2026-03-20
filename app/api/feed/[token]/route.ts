import { createAdminClient } from "@/lib/supabase/server";
import { SiteConfig } from "@/site-config";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toRfc822(dateStr: string): string {
  return new Date(dateStr).toUTCString();
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const admin = createAdminClient();

  // Resolve user by rss_token
  const { data: profile } = await admin
    .from("profiles")
    .select("id, email")
    .eq("rss_token", token)
    .single();

  if (!profile) {
    return new Response("Not found", { status: 404 });
  }

  // Fetch last 50 sent deliveries
  const { data: deliveries } = await admin
    .from("deliveries")
    .select("video_id, sent_at, language")
    .eq("user_id", profile.id)
    .eq("status", "sent")
    .order("sent_at", { ascending: false })
    .limit(50);

  if (!deliveries || deliveries.length === 0) {
    return buildFeed(profile.email, []);
  }

  const videoIds = [...new Set(deliveries.map((d) => d.video_id))];

  const { data: videos } = await admin
    .from("processed_videos")
    .select("video_id, video_title, video_url, summary, audio_url, channel_id")
    .in("video_id", videoIds)
    .eq("status", "completed")
    .not("audio_url", "is", null);

  const videoMap = new Map((videos ?? []).map((v) => [v.video_id, v]));

  const items = deliveries
    .map((d) => {
      const v = videoMap.get(d.video_id);
      if (!v?.audio_url) return null;
      return {
        videoId: d.video_id,
        title: v.video_title ?? d.video_id,
        audioUrl: v.audio_url,
        videoUrl:
          v.video_url ?? `https://www.youtube.com/watch?v=${d.video_id}`,
        summary: v.summary ?? "",
        sentAt: d.sent_at ?? new Date().toISOString(),
        language: d.language,
      };
    })
    .filter((i): i is NonNullable<typeof i> => i !== null);

  return buildFeed(profile.email, items);
}

type FeedItem = {
  videoId: string;
  title: string;
  audioUrl: string;
  videoUrl: string;
  summary: string;
  sentAt: string;
  language: string | null;
};

function buildFeed(email: string, items: FeedItem[]): Response {
  const feedTitle = `BriefTube — ${email}`;
  const feedLink = SiteConfig.prodUrl;
  const feedDesc = "Your YouTube channel summaries as a podcast feed";
  const lastBuild =
    items.length > 0 ? toRfc822(items[0].sentAt) : new Date().toUTCString();

  const itemsXml = items
    .map((item) => {
      const summaryText =
        item.summary.length > 500
          ? `${item.summary.slice(0, 497)}…`
          : item.summary;
      return `
    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.videoUrl)}</link>
      <guid isPermaLink="false">${escapeXml(item.videoId)}-${item.language ?? "en"}</guid>
      <pubDate>${toRfc822(item.sentAt)}</pubDate>
      <description>${escapeXml(summaryText)}</description>
      <enclosure url="${escapeXml(item.audioUrl)}" type="audio/mpeg" length="0" />
      <itunes:duration>0</itunes:duration>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(feedTitle)}</title>
    <link>${escapeXml(feedLink)}</link>
    <description>${escapeXml(feedDesc)}</description>
    <language>en</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <image>
      <url>${escapeXml(feedLink)}/logo-hd.png</url>
      <title>${escapeXml(feedTitle)}</title>
      <link>${escapeXml(feedLink)}</link>
    </image>
    <itunes:image href="${escapeXml(feedLink)}/logo-hd.png" />
    <itunes:category text="Technology" />
    <itunes:explicit>false</itunes:explicit>
${itemsXml}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=900, s-maxage=900",
    },
  });
}
