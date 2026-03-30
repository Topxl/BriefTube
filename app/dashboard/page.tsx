import { SiteConfig } from "@/site-config";
import { Suspense, cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SummariesFeed } from "@/components/dashboard/summaries-feed";
import { SummariesFeedSkeleton } from "@/components/dashboard/summaries-feed-skeleton";
import { TrialBanner } from "@/components/dashboard/trial-banner";
import { ActivationBanner } from "@/components/dashboard/activation-banner";
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

const getProfile = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select(
      "subscription_status, trial_ends_at, max_channels, preferred_language, favorite_languages",
    )
    .eq("id", userId)
    .single();
  return data;
});

async function DashboardBanners({ userId }: { userId: string }) {
  const profile = await getProfile(userId);
  if (!profile) return null;

  const supabase = await createClient();
  const { data: connections } = await supabase
    .from("platform_connections")
    .select("platform")
    .eq("user_id", userId)
    .eq("connected", true);

  const { data: sources } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .or("source_type.is.null,source_type.eq.youtube_channel")
    .limit(1);

  const hasChannel = (sources ?? []).length > 0;
  const hasConnection = (connections ?? []).length > 0;

  const trialEndsAt = profile.trial_ends_at ?? null;
  const nowMs = Date.now();
  const trialDaysLeft = trialEndsAt
    ? Math.ceil((new Date(trialEndsAt).getTime() - nowMs) / 86400000)
    : 0;

  return (
    <>
      <ActivationBanner hasConnection={hasConnection} />
      <GettingStarted
        hasChannel={hasChannel}
        hasConnection={hasConnection}
        language={profile.preferred_language ?? "en"}
      />
      {trialDaysLeft > 0 && <TrialBanner daysLeft={trialDaysLeft} />}
    </>
  );
}

async function ChannelsSheetSection({ userId }: { userId: string }) {
  const profile = await getProfile(userId);
  if (!profile) return null;

  const supabase = await createClient();
  const [{ data: sources }, { data: listFollowSources }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .or("source_type.is.null,source_type.eq.youtube_channel")
      .order("created_at", { ascending: false }),
    supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .eq("source_type", "list_follow")
      .order("created_at", { ascending: false }),
  ]);

  const isPro =
    profile.subscription_status === "active" ||
    (profile.trial_ends_at != null &&
      new Date(profile.trial_ends_at) > new Date());
  const maxChannels = profile.max_channels ?? SiteConfig.freeChannelsLimit;

  return (
    <ChannelsSheet
      initialSources={sources ?? []}
      initialListFollowSources={listFollowSources ?? []}
      maxChannels={maxChannels}
      isPro={isPro}
    />
  );
}

async function FeedSection({ userId }: { userId: string }) {
  const profile = await getProfile(userId);
  if (!profile) return null;

  const supabase = await createClient();
  const { data: deliveryData } = await supabase.rpc("get_feed_deliveries", {
    p_user_id: userId,
    p_limit: FEED_PAGE_SIZE,
    p_offset: 0,
  });

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

  const preferredLang = profile.preferred_language ?? "en";
  const initialFavLangs = [
    ...new Set([...profile.favorite_languages, preferredLang]),
  ];

  return (
    <SummariesFeed
      initialDeliveries={initialDeliveries}
      initialPreferredLang={preferredLang}
      initialFavLangs={initialFavLangs}
    />
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col gap-4">
      <Suspense fallback={null}>
        <DashboardBanners userId={user.id} />
      </Suspense>

      <Suspense fallback={null}>
        <VideoHighlighter />
      </Suspense>

      <Suspense fallback={null}>
        <PushNotificationBanner />
      </Suspense>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Recent summaries</h2>
          <div className="flex items-center gap-1">
            <Suspense
              fallback={
                <div className="h-8 w-16 animate-pulse rounded-md bg-white/[0.06]" />
              }
            >
              <ChannelsSheetSection userId={user.id} />
            </Suspense>
            <StatsSheet />
          </div>
        </div>
        <PendingVideoProcessor />
        <Suspense fallback={null}>
          <ProcessingVideoCard />
        </Suspense>
        <SectionErrorBoundary>
          <Suspense fallback={<SummariesFeedSkeleton />}>
            <FeedSection userId={user.id} />
          </Suspense>
        </SectionErrorBoundary>
      </div>
    </div>
  );
}
