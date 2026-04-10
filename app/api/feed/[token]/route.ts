import { createAdminClient } from "@/lib/supabase/server";
import {
  checkRateLimit,
  getRequestIp,
  publicRateLimit,
} from "@/lib/rate-limit";
import { SiteConfig } from "@/site-config";
import type { NextRequest } from "next/server";
import { connection } from "next/server";

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
  const rateLimitResponse = await checkRateLimit(
    publicRateLimit,
    `feed:${getRequestIp(_req)}`,
  );
  if (rateLimitResponse) return rateLimitResponse;

  await connection();
  const { token } = await params;

  const admin = createAdminClient();

  // Resolve user by rss_token
  const { data: profile } = await admin
    .from("profiles")
    .select("id, email, preferred_language, audio_enabled")
    .eq("rss_token", token)
    .single();

  if (!profile) {
    return new Response("Not found", { status: 404 });
  }

  const audioEnabled = profile.audio_enabled !== false;

  // Fetch active subscriptions for the user
  const { data: subscriptions } = await admin
    .from("subscriptions")
    .select("channel_id")
    .eq("user_id", profile.id)
    .eq("active", true);

  if (!subscriptions || subscriptions.length === 0) {
    return buildFeed(profile.email, []);
  }

  const channelIds = subscriptions.map((s) => s.channel_id);
  const lang = profile.preferred_language ?? "en";

  // Fetch last 50 completed videos for those channels in the user's language
  let query = admin
    .from("processed_videos")
    .select(
      "video_id, video_title, video_url, summary, audio_url, processed_at, language",
    )
    .in("channel_id", channelIds)
    .eq("status", "completed")
    .eq("language", lang)
    .order("processed_at", { ascending: false })
    .limit(50);

  // If audio is enabled, only show videos with audio ready (podcast feed)
  if (audioEnabled) {
    query = query.not("audio_url", "is", null);
  }

  const { data: videos } = await query;

  if (!videos || videos.length === 0) {
    return buildFeed(profile.email, []);
  }

  const items = videos.map((v) => ({
    videoId: v.video_id,
    title: v.video_title ?? v.video_id,
    audioUrl: v.audio_url as string | null,
    videoUrl: v.video_url ?? `https://www.youtube.com/watch?v=${v.video_id}`,
    summary: v.summary ?? "",
    sentAt: v.processed_at ?? new Date().toISOString(),
    language: v.language,
  }));

  return buildFeed(profile.email, items);
}

type FeedItem = {
  videoId: string;
  title: string;
  audioUrl: string | null;
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
      <description>${escapeXml(summaryText)}</description>${
        item.audioUrl
          ? `
      <enclosure url="${escapeXml(item.audioUrl)}" type="audio/mpeg" length="0" />
      <itunes:duration>0</itunes:duration>`
          : ""
      }
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
