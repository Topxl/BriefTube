import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/server";
import { SiteConfig } from "@/site-config";
import { Typography } from "@/components/nowts/typography";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";

export const metadata: Metadata = {
  title: "YouTube Channels with AI Audio Summaries",
  description:
    "Discover the most popular YouTube channels on BriefTube. Get AI-powered audio summaries delivered automatically to Telegram, Discord, Slack, or your podcast app.",
  alternates: {
    canonical: `${SiteConfig.prodUrl}/channels`,
  },
  openGraph: {
    title: "YouTube Channels with AI Audio Summaries — BriefTube",
    description:
      "Discover the most popular YouTube channels on BriefTube. Get AI-powered audio summaries delivered automatically to Telegram, Discord, Slack, or your podcast app.",
    type: "website",
  },
};

type ChannelEntry = {
  channelId: string;
  channelName: string;
  channelAvatarUrl: string | null;
  followerCount: number;
};

export default async function ChannelsIndexPage() {
  const supabase = createAdminClient();

  const { data: rows } = await supabase
    .from("subscriptions")
    .select("channel_id, channel_name, channel_avatar_url")
    .eq("active", true);

  // Aggregate by channel_id
  const channelMap: Partial<Record<string, ChannelEntry>> = {};
  for (const s of rows ?? []) {
    const entry = channelMap[s.channel_id];
    if (entry) {
      entry.followerCount++;
    } else {
      channelMap[s.channel_id] = {
        channelId: s.channel_id,
        channelName: s.channel_name,
        channelAvatarUrl: s.channel_avatar_url,
        followerCount: 1,
      };
    }
  }

  const channels = (Object.values(channelMap).filter(Boolean) as ChannelEntry[])
    .sort((a, b) => b.followerCount - a.followerCount)
    .slice(0, 100);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/[0.06] backdrop-blur-2xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
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
            <Link href="/login">Start free trial</Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-8">
          <Typography variant="h1">
            YouTube Channels with AI Summaries
          </Typography>
          <Typography variant="muted" className="mt-2">
            The most followed YouTube channels on BriefTube — get AI-powered
            audio summaries delivered automatically wherever you listen.
          </Typography>
        </div>

        {channels.length === 0 ? (
          <Typography variant="muted">No channels yet.</Typography>
        ) : (
          <div className="flex flex-col gap-2">
            {channels.map((ch, i) => (
              <Link
                key={ch.channelId}
                href={`/channels/${ch.channelId}`}
                className="nm-raised group flex items-center gap-4 rounded-2xl px-4 py-3 transition-transform hover:scale-[1.01]"
              >
                {/* Rank */}
                <span className="text-muted-foreground/40 w-6 shrink-0 text-right text-sm tabular-nums">
                  {i + 1}
                </span>

                {/* Avatar */}
                {ch.channelAvatarUrl ? (
                  <img
                    src={ch.channelAvatarUrl}
                    alt={ch.channelName}
                    width={40}
                    height={40}
                    className="h-10 w-10 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                    {ch.channelName.charAt(0).toUpperCase()}
                  </div>
                )}

                {/* Name */}
                <p className="min-w-0 flex-1 truncate text-sm font-medium group-hover:underline">
                  {ch.channelName}
                </p>

                {/* Follower count */}
                <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs tabular-nums">
                  <Users className="h-3 w-3" />
                  {ch.followerCount}
                </span>
              </Link>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="nm-raised mt-12 rounded-2xl p-6 text-center">
          <Typography variant="h3">
            Don&apos;t miss a single video from your favorites
          </Typography>
          <Typography variant="muted" className="mt-3">
            BriefTube monitors your YouTube channels and sends AI-powered audio
            summaries as audio, automatically. Listen in Telegram, Discord,
            Slack, or your podcast app.
          </Typography>
          <Button
            asChild
            size="lg"
            className="mt-5 rounded-full bg-red-600 hover:bg-red-500"
          >
            <Link href="/login">
              Start free — {SiteConfig.freeChannelsLimit} channels
            </Link>
          </Button>
        </div>
      </div>
    </>
  );
}
