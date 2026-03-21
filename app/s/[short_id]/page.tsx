import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { SiteConfig } from "@/site-config";
import {
  SharedSummaryView,
  ExpiredSummaryView,
} from "@/components/share/shared-summary-view";

type Props = {
  params: Promise<{ short_id: string }>;
  searchParams: Promise<{ lang?: string }>;
};

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { short_id } = await params;
  const { lang } = await searchParams;

  const supabase = createAdminClient();

  const { data: share } = await supabase
    .from("shared_summaries")
    .select("video_id, language")
    .eq("short_id", short_id)
    .single();

  if (!share)
    return { title: SiteConfig.title, robots: { index: false, follow: false } };

  const language = lang ?? share.language;

  const { data: video } = await supabase
    .from("processed_videos")
    .select("video_title, summary")
    .eq("video_id", share.video_id)
    .eq("language", language)
    .single();

  if (!video)
    return { title: SiteConfig.title, robots: { index: false, follow: false } };

  const ogTitle = `AI Summary: ${video.video_title}`;
  const ogDescription = (video.summary ?? "").slice(0, 160);
  const ogImage = `https://img.youtube.com/vi/${share.video_id}/hqdefault.jpg`;

  return {
    title: ogTitle,
    description: ogDescription,
    robots: { index: false, follow: false },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      images: [{ url: ogImage }],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      images: [ogImage],
    },
  };
}

export default async function SharedSummaryPage({
  params,
  searchParams,
}: Props) {
  const { short_id } = await params;
  const { lang } = await searchParams;

  const supabase = createAdminClient();

  // 1. Fetch the share record
  const { data: share } = await supabase
    .from("shared_summaries")
    .select("id, video_id, language, view_count, max_views, expires_at")
    .eq("short_id", short_id)
    .single();

  if (!share) notFound();

  // 2. Check expiry and view limit
  const isExpired =
    new Date(share.expires_at) < new Date() ||
    (share.view_count !== null &&
      share.max_views !== null &&
      share.view_count >= share.max_views);

  if (isExpired) {
    return <ExpiredSummaryView loginUrl="/login" />;
  }

  // 3. Increment view count (non-blocking — fire and forget)
  void supabase
    .from("shared_summaries")
    .update({ view_count: (share.view_count ?? 0) + 1 })
    .eq("id", share.id);

  // 4. Resolve language: query param takes priority
  const language = lang ?? share.language;

  // 5. Fetch video in the requested language
  const { data: video } = await supabase
    .from("processed_videos")
    .select("video_title, summary, audio_url")
    .eq("video_id", share.video_id)
    .eq("language", language)
    .single();

  if (!video) notFound();

  // 6. Fetch all available languages for this video
  const { data: allLangRows } = await supabase
    .from("processed_videos")
    .select("language")
    .eq("video_id", share.video_id)
    .eq("status", "completed");

  const availableLanguages = (allLangRows ?? []).map(
    (r) => r.language as string,
  );

  return (
    <SharedSummaryView
      videoId={share.video_id}
      videoTitle={video.video_title ?? ""}
      summary={video.summary ?? ""}
      audioUrl={video.audio_url ?? ""}
      currentLanguage={language}
      availableLanguages={availableLanguages}
      shortId={short_id}
    />
  );
}
