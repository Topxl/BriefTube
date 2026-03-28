import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
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
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!video) {
    return { title: SiteConfig.title };
  }

  const description = `YouTube summary of "${video.video_title}". Get the key insights without watching the full video — AI-generated audio summary by BriefTube.`;

  return {
    title: `${video.video_title} — YouTube Summary`,
    description,
    alternates: {
      canonical: `${SiteConfig.prodUrl}/videos/${video_id}`,
    },
    openGraph: {
      type: "article",
      title: `${video.video_title} — YouTube Summary`,
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
      title: `${video.video_title} — YouTube Summary`,
      description,
      images: [`https://img.youtube.com/vi/${video_id}/hqdefault.jpg`],
    },
  };
}

export default async function VideoPage({ params }: Props) {
  const { video_id } = await params;

  const supabase = createAdminClient();

  // Fetch video — pick the earliest language version (original) when multiple exist
  const { data: video } = await supabase
    .from("processed_videos")
    .select("video_id, video_title, summary, channel_id, created_at, language")
    .eq("video_id", video_id)
    .eq("status", "completed")
    .order("created_at", { ascending: true })
    .limit(1)
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

  const summaryText = video.summary ?? "";
  const wordCount = summaryText.split(/\s+/).filter(Boolean).length;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: video.video_title,
    description: summaryText.slice(0, 200),
    image: `https://img.youtube.com/vi/${video_id}/hqdefault.jpg`,
    datePublished: video.created_at
      ? new Date(video.created_at).toISOString()
      : new Date().toISOString(),
    author: {
      "@type": "Organization",
      name: "BriefTube",
      url: SiteConfig.prodUrl,
    },
    publisher: {
      "@type": "Organization",
      name: "BriefTube",
      url: SiteConfig.prodUrl,
      logo: {
        "@type": "ImageObject",
        url: `${SiteConfig.prodUrl}/logo-120.png`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SiteConfig.prodUrl}/videos/${video_id}`,
    },
    about: {
      "@type": "VideoObject",
      name: video.video_title,
      thumbnailUrl: `https://img.youtube.com/vi/${video_id}/hqdefault.jpg`,
      embedUrl: `https://www.youtube.com/embed/${video_id}`,
      contentUrl: `https://youtu.be/${video_id}`,
    },
    wordCount,
    articleSection: "YouTube Summary",
    inLanguage: video.language || "en",
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
        item: `${SiteConfig.prodUrl}/channels/${video.channel_id}`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: video.video_title ?? "Video",
        item: `${SiteConfig.prodUrl}/videos/${video_id}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
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
              <Image
                src={`https://img.youtube.com/vi/${video_id}/hqdefault.jpg`}
                alt={video.video_title ?? "Video"}
                width={480}
                height={360}
                className="w-full rounded-xl object-cover"
                priority
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
                audio summaries, and delivers them wherever you listen.
                Telegram, Discord, Slack, or your podcast app. Fully automated.
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
