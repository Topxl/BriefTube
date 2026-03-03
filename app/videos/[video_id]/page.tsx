import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { SiteConfig } from "@/site-config";
import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "@/lib/icons";

type Props = {
  params: Promise<{ video_id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { video_id } = await params;

  const supabase = createAdminClient();

  const { data: video } = await supabase
    .from("processed_videos")
    .select("video_id, video_title, summary, channel_id, created_at, language")
    .eq("video_id", video_id)
    .eq("status", "completed")
    .maybeSingle();

  if (!video) {
    return { title: SiteConfig.title };
  }

  const description = `AI-generated summary of "${video.video_title}". Get the key insights without watching the full video.`;

  return {
    title: `${video.video_title} — AI Summary`,
    description,
    alternates: {
      canonical: `${SiteConfig.prodUrl}/videos/${video_id}`,
    },
    openGraph: {
      type: "article",
      title: `${video.video_title} — AI Summary`,
      description,
      url: `${SiteConfig.prodUrl}/videos/${video_id}`,
      images: [
        {
          url: `https://img.youtube.com/vi/${video_id}/hqdefault.jpg`,
          width: 480,
          height: 360,
          alt: video.video_title ?? "Video thumbnail",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${video.video_title} — AI Summary`,
      description,
      images: [`https://img.youtube.com/vi/${video_id}/hqdefault.jpg`],
    },
  };
}

export default async function VideoPage({ params }: Props) {
  const { video_id } = await params;

  const supabase = createAdminClient();

  // Fetch video
  const { data: video } = await supabase
    .from("processed_videos")
    .select("video_id, video_title, summary, channel_id, created_at, language")
    .eq("video_id", video_id)
    .eq("status", "completed")
    .maybeSingle();

  if (!video) {
    notFound();
  }

  // Fetch channel info
  const { data: channel } = await supabase
    .from("subscriptions")
    .select("channel_name, channel_avatar_url")
    .eq("channel_id", video.channel_id)
    .limit(1)
    .maybeSingle();

  const channelName = channel?.channel_name ?? "Unknown Channel";

  const formattedDate = video.created_at
    ? new Date(video.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: video.video_title,
    description: video.summary?.slice(0, 200),
    thumbnailUrl: `https://img.youtube.com/vi/${video_id}/hqdefault.jpg`,
    uploadDate: video.created_at,
    embedUrl: `https://www.youtube.com/embed/${video_id}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="bg-background min-h-screen">
        <Navbar />

        <main className="mx-auto max-w-2xl px-6 pt-32 pb-20">
          {/* Back link */}
          <Link
            href={`/channels/${video.channel_id}`}
            className="text-muted-foreground hover:text-foreground mb-10 inline-flex items-center gap-1.5 text-sm transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {channelName}
          </Link>

          <article className="flex flex-col gap-10">
            {/* Video header */}
            <header className="nm-raised flex flex-col gap-4 rounded-2xl p-6">
              {/* Thumbnail */}
              <img
                src={`https://img.youtube.com/vi/${video_id}/hqdefault.jpg`}
                alt={video.video_title ?? "Video"}
                className="w-full rounded-xl object-cover"
              />

              {/* Title */}
              <h1 className="font-display text-2xl leading-snug font-bold md:text-3xl">
                {video.video_title}
              </h1>

              {/* Meta */}
              <div className="text-muted-foreground flex items-center gap-3 border-t border-white/[0.05] pt-3 text-xs">
                <Link
                  href={`/channels/${video.channel_id}`}
                  className="hover:text-foreground transition-colors"
                >
                  {channelName}
                </Link>
                <span className="text-white/20">·</span>
                {formattedDate && <span>{formattedDate}</span>}
              </div>
            </header>

            {/* Summary section */}
            <div>
              <p className="text-muted-foreground mb-4 text-xs font-medium tracking-widest uppercase">
                AI Summary
              </p>
              <div className="text-foreground text-sm leading-relaxed whitespace-pre-line">
                {video.summary}
              </div>
            </div>

            {/* CTA */}
            <div className="nm-raised flex flex-col gap-4 rounded-2xl border border-red-500/[0.12] p-6">
              <p className="font-display text-lg font-semibold">
                Get summaries like this automatically
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                BriefTube monitors your YouTube channels, generates AI-powered
                summaries, and delivers audio to your Telegram — fully
                automated.
              </p>
              <Button
                className="w-fit bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.25)] hover:bg-red-500"
                asChild
              >
                <Link href="/login">Start Free Trial</Link>
              </Button>
            </div>

            {/* Back link */}
            <Link
              href={`/channels/${video.channel_id}`}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to {channelName}
            </Link>
          </article>
        </main>

        <Footer />
      </div>
    </>
  );
}
