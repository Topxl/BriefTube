import { SiteConfig } from "@/site-config";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SummariesFeed } from "@/components/dashboard/summaries-feed";
import { SummariesFeedSkeleton } from "@/components/dashboard/summaries-feed-skeleton";
import { TrialBanner } from "@/components/dashboard/trial-banner";
import { SectionErrorBoundary } from "@/components/nowts/section-error-boundary";
import { PushNotificationBanner } from "@/components/dashboard/push-notification-banner";
import { GettingStarted } from "@/components/dashboard/getting-started";
import { ProcessingVideoCard } from "@/components/dashboard/processing-video-card";
import { PendingVideoProcessor } from "@/components/dashboard/pending-video-processor";
import { StatsSheet } from "@/components/dashboard/stats-sheet";
import { ChannelsSheet } from "@/components/dashboard/channels-sheet";
import { VideoHighlighter } from "@/components/dashboard/video-highlighter";
import type {
  EnrichedDelivery,
  ProcessedVideo,
} from "@/components/dashboard/summary-row";

const FEED_PAGE_SIZE = 20;

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [
    { data: profile },
    { data: sources },
    { data: connections },
    { data: deliveryData },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "subscription_status, trial_ends_at, max_channels, preferred_language, favorite_languages",
      )
      .eq("id", user.id)
      .single(),
    supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .or("source_type.is.null,source_type.eq.youtube_channel")
      .order("created_at", { ascending: false }),
    supabase
      .from("platform_connections")
      .select("platform")
      .eq("user_id", user.id)
      .eq("connected", true),
    supabase
      .from("deliveries")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(0, FEED_PAGE_SIZE - 1),
  ]);

  // Prefetch videos for the first page of deliveries
  let initialDeliveries: EnrichedDelivery[] = [];
  if (deliveryData && deliveryData.length > 0) {
    const videoIds = [...new Set(deliveryData.map((d) => d.video_id))];
    const languages = [...new Set(deliveryData.map((d) => d.language))];
    const { data: videos } = await supabase
      .from("processed_videos")
      .select(
        "video_id, language, video_title, video_url, summary, audio_url, channel_id, status",
      )
      .in("video_id", videoIds)
      .in("language", languages);

    const videoMap: Record<string, ProcessedVideo> = {};
    for (const v of videos ?? []) {
      videoMap[`${v.video_id}:${v.language}`] = v;
      videoMap[v.video_id] ??= v;
    }
    initialDeliveries = deliveryData.map((d) => ({
      ...d,
      video: videoMap[`${d.video_id}:${d.language}`] ?? videoMap[d.video_id],
    }));
  }

  if (!profile) {
    redirect("/login");
  }

  const isPro =
    profile.subscription_status === "active" ||
    (profile.trial_ends_at != null &&
      new Date(profile.trial_ends_at) > new Date());
  const maxChannels = profile.max_channels ?? SiteConfig.freeChannelsLimit;

  const preferredLang = profile.preferred_language ?? "fr";
  const initialFavLangs = [
    ...new Set([...profile.favorite_languages, preferredLang]),
  ];

  // Trial logic — Server Component, Date.now() is safe here (not a client hook)
  const trialEndsAt = profile.trial_ends_at ?? null;
  const nowMs = Date.now();
  const trialDaysLeft = trialEndsAt
    ? Math.ceil((new Date(trialEndsAt).getTime() - nowMs) / 86400000)
    : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Getting started — only if needed */}
      <GettingStarted
        hasChannel={(sources ?? []).length > 0}
        hasConnection={(connections ?? []).length > 0}
        language={profile.preferred_language ?? "fr"}
      />

      {/* Deep-link from email digest — highlights the target video */}
      <Suspense fallback={null}>
        <VideoHighlighter />
      </Suspense>

      {/* Push notification banner */}
      <Suspense fallback={null}>
        <PushNotificationBanner />
      </Suspense>

      {/* Trial banner */}
      {trialDaysLeft > 0 && <TrialBanner daysLeft={trialDaysLeft} />}

      {/* Summaries — main content */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Recent summaries</h2>
          <div className="flex items-center gap-1">
            <ChannelsSheet
              initialSources={sources ?? []}
              maxChannels={maxChannels}
              isPro={isPro}
            />
            <StatsSheet />
          </div>
        </div>
        <PendingVideoProcessor />
        <Suspense fallback={null}>
          <ProcessingVideoCard />
        </Suspense>
        <SectionErrorBoundary>
          <Suspense fallback={<SummariesFeedSkeleton />}>
            <SummariesFeed
              initialDeliveries={initialDeliveries}
              initialPreferredLang={preferredLang}
              initialFavLangs={initialFavLangs}
            />
          </Suspense>
        </SectionErrorBoundary>
      </div>
    </div>
  );
}
