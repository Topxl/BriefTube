import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { SiteConfig } from "@/site-config";
import { Typography } from "@/components/nowts/typography";
import { Button } from "@/components/ui/button";

type Props = {
  params: Promise<{ channel_id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { channel_id } = await params;

  const supabase = createAdminClient();

  const { data: channel } = await supabase
    .from("subscriptions")
    .select("channel_name, channel_avatar_url")
    .eq("channel_id", channel_id)
    .limit(1)
    .single();

  if (!channel) return { title: SiteConfig.title };

  const channelName = channel.channel_name;
  const ogImage =
    channel.channel_avatar_url ??
    "https://img.youtube.com/vi/default/hqdefault.jpg";
  const ogDescription = `AI-generated summaries of every ${channelName} video, delivered as audio. Never miss a key insight from ${channelName} again.`;

  return {
    title: `${channelName} — AI Audio Summaries`,
    description: ogDescription,
    openGraph: {
      title: `${channelName} — AI Audio Summaries`,
      description: ogDescription,
      images: [{ url: ogImage }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${channelName} — AI Audio Summaries`,
      description: ogDescription,
      images: [ogImage],
    },
    alternates: {
      canonical: `${SiteConfig.prodUrl}/channels/${channel_id}`,
    },
  };
}

export default async function ChannelPage({ params }: Props) {
  const { channel_id } = await params;

  const supabase = createAdminClient();

  // 1. Fetch channel info + follower count in parallel
  const [{ data: channel }, { count: followerCount }, { data: lastVideo }] =
    await Promise.all([
      supabase
        .from("subscriptions")
        .select("channel_name, channel_avatar_url")
        .eq("channel_id", channel_id)
        .limit(1)
        .single(),
      supabase
        .from("subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("channel_id", channel_id)
        .eq("active", true),
      supabase
        .from("processed_videos")
        .select("created_at")
        .eq("channel_id", channel_id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (!channel) notFound();

  const channelName = channel.channel_name;
  const channelAvatarUrl =
    channel.channel_avatar_url ||
    "https://img.youtube.com/vi/default/hqdefault.jpg";

  const lastSummaryDate = lastVideo?.created_at
    ? new Date(lastVideo.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  // 2. Fetch summaries in English first
  let { data: videos } = await supabase
    .from("processed_videos")
    .select("video_id, video_title, summary, created_at")
    .eq("channel_id", channel_id)
    .eq("status", "completed")
    .eq("language", "en")
    .order("created_at", { ascending: false })
    .limit(20);

  // 3. If no English results, try French
  if (!videos || videos.length === 0) {
    const { data: frenchVideos } = await supabase
      .from("processed_videos")
      .select("video_id, video_title, summary, created_at")
      .eq("channel_id", channel_id)
      .eq("status", "completed")
      .eq("language", "fr")
      .order("created_at", { ascending: false })
      .limit(20);

    videos = frenchVideos;
  }

  // 4. Return notFound if no summaries
  if (!videos || videos.length === 0) {
    notFound();
  }

  const truncateSummary = (text: string | null, lines = 3): string => {
    if (!text) return "";
    return text.split("\n").slice(0, lines).join("\n");
  };

  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${channelName} — AI Audio Summaries`,
    description: `AI-generated summaries of ${channelName} videos, delivered as audio.`,
    itemListElement: videos.map((v, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SiteConfig.prodUrl}/videos/${v.video_id}`,
      name: v.video_title ?? "Untitled Video",
    })),
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: SiteConfig.prodUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Channels",
        item: `${SiteConfig.prodUrl}/channels`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: channelName,
        item: `${SiteConfig.prodUrl}/channels/${channel_id}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      <header className="sticky top-0 z-40 border-b border-white/[0.06] backdrop-blur-2xl">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo.svg"
              alt="BriefTube"
              width={28}
              height={28}
              suppressHydrationWarning
            />
            <span className="text-sm font-semibold">BriefTube</span>
          </Link>
          <Button size="sm" className="bg-red-600 hover:bg-red-500" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Channel header */}
        <div className="mb-8 flex items-center gap-4">
          <Image
            src={channelAvatarUrl}
            alt={channelName}
            width={64}
            height={64}
            className="h-16 w-16 rounded-full object-cover"
            priority
          />
          <div className="flex-1">
            <a
              href={`https://www.youtube.com/channel/${channel_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2"
            >
              <Typography variant="h1" className="group-hover:underline">
                {channelName}
              </Typography>
              <ExternalLink className="text-muted-foreground h-5 w-5" />
            </a>
            <Typography variant="muted" className="mt-1">
              AI Audio Summaries
            </Typography>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-8 flex flex-wrap gap-2">
          <div className="rounded-full bg-white/5 px-4 py-2">
            <Typography variant="muted" className="text-sm">
              {videos.length} videos summarized
            </Typography>
          </div>
          {(followerCount ?? 0) > 0 && (
            <div className="rounded-full bg-white/5 px-4 py-2">
              <Typography variant="muted" className="text-sm">
                {followerCount} follower{followerCount === 1 ? "" : "s"} on
                BriefTube
              </Typography>
            </div>
          )}
          {lastSummaryDate && (
            <div className="rounded-full bg-white/5 px-4 py-2">
              <Typography variant="muted" className="text-sm">
                Last summary: {lastSummaryDate}
              </Typography>
            </div>
          )}
        </div>

        {/* Videos grid */}
        <div className="flex flex-col gap-4">
          {videos.map((video) => {
            const thumbnailUrl = `https://img.youtube.com/vi/${video.video_id}/hqdefault.jpg`;
            const youtubeUrl = `https://youtu.be/${video.video_id}`;
            const truncatedSummary = truncateSummary(video.summary);

            return (
              <Link
                key={video.video_id}
                href={`/videos/${video.video_id}`}
                className="nm-raised group overflow-hidden rounded-2xl p-4 transition-transform hover:scale-[1.02]"
              >
                <div className="flex items-start gap-4">
                  <div className="shrink-0 overflow-hidden rounded-xl">
                    <Image
                      src={thumbnailUrl}
                      alt={video.video_title ?? "Video"}
                      width={160}
                      height={90}
                      className="h-[90px] w-[160px] object-cover"
                      loading="lazy"
                    />
                  </div>

                  <div className="flex min-w-0 flex-col gap-2">
                    <Typography
                      variant="h3"
                      className="line-clamp-2 group-hover:underline"
                    >
                      {video.video_title ?? "Untitled Video"}
                    </Typography>
                    <Typography variant="p" className="line-clamp-3 text-sm">
                      {truncatedSummary || "No summary available"}
                    </Typography>
                    <div className="flex items-center gap-3">
                      <Typography variant="muted" className="text-xs">
                        Read AI summary
                      </Typography>
                      <a
                        href={youtubeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-muted-foreground/50 hover:text-muted-foreground inline-flex items-center gap-1 text-xs transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        YouTube
                      </a>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* CTA block */}
        <div className="nm-raised mt-12 rounded-2xl p-6 text-center">
          <Typography variant="h3">
            Get summaries for YOUR channels, automatically in Telegram
          </Typography>
          <Typography variant="muted" className="mt-3">
            BriefTube monitors your YouTube channels, generates AI-powered
            summaries, and delivers audio to your Telegram — fully automated.
          </Typography>
          <Button
            asChild
            size="lg"
            className="mt-5 rounded-full bg-red-600 hover:bg-red-500"
          >
            <Link href="/login">Start free trial</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
