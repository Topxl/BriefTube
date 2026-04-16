import { SiteConfig } from "@/site-config";
import { Suspense, cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SummariesFeed } from "@/components/dashboard/summaries-feed";
import { SummariesFeedSkeleton } from "@/components/dashboard/summaries-feed-skeleton";
import { TrialBanner } from "@/components/dashboard/trial-banner";
import { SectionErrorBoundary } from "@/components/nowts/section-error-boundary";
import { PushNotificationBanner } from "@/components/dashboard/push-notification-banner";
import { GettingStarted } from "@/components/dashboard/getting-started";
import { ProcessingVideoCard } from "@/components/dashboard/processing-video-card";
import { PendingVideoPickup } from "@/components/dashboard/pending-video-pickup";
import { PendingVideoProcessor } from "@/components/dashboard/pending-video-processor";
import { StatsSheet } from "@/components/dashboard/stats-sheet";
import { ChannelsSheet } from "@/components/dashboard/channels-sheet";
import { VideoHighlighter } from "@/components/dashboard/video-highlighter";
import type {
  EnrichedDelivery,
  ProcessedVideo,
} from "@/components/dashboard/summary-row";

const FEED_PAGE_SIZE = 20;

const R2 = "https://pub-56ac81959a8e42beae1539d791297d90.r2.dev";

/** Demo videos shown to new users with an empty feed */
const DEMO_DELIVERIES: EnrichedDelivery[] = [
  {
    id: "demo-ted-sinek",
    user_id: "demo",
    video_id: "qp0HIF3SfI4",
    status: "sent",
    source: "demo",
    sent_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    language: "en",
    video: {
      video_id: "qp0HIF3SfI4",
      video_title: "How Great Leaders Inspire Action | Simon Sinek | TED",
      video_url: "https://www.youtube.com/watch?v=qp0HIF3SfI4",
      summary: null, // loaded from DB at runtime
      audio_url: `${R2}/audio/qp0HIF3SfI4_en.mp3`,
      channel_id: "UCAuUUnT6oDeKwE6v1NGQxug",
      status: "completed",
    },
  },
  {
    id: "demo-huberman-sleep",
    user_id: "demo",
    video_id: "nm1TxQj9IsQ",
    status: "sent",
    source: "demo",
    sent_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    language: "en",
    video: {
      video_id: "nm1TxQj9IsQ",
      video_title: "Master Your Sleep & Be More Alert When Awake",
      video_url: "https://www.youtube.com/watch?v=nm1TxQj9IsQ",
      summary: null, // loaded from DB at runtime
      audio_url: `${R2}/audio/nm1TxQj9IsQ_en.mp3`,
      channel_id: "UC2D2CMWXMOVWx7giW1n3LIg",
      status: "completed",
    },
  },
];

const getProfile = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select(
      "subscription_status, trial_ends_at, max_channels, preferred_language, favorite_languages, onboarding_completed",
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
  const onboardingCompleted = profile.onboarding_completed ?? false;

  const trialEndsAt = profile.trial_ends_at ?? null;
  const nowMs = Date.now();
  const trialDaysLeft = trialEndsAt
    ? Math.ceil((new Date(trialEndsAt).getTime() - nowMs) / 86400000)
    : 0;

  return (
    <>
      <GettingStarted
        hasChannel={hasChannel}
        hasConnection={hasConnection}
        onboardingCompleted={onboardingCompleted}
      />
      {trialDaysLeft > 0 && <TrialBanner daysLeft={trialDaysLeft} />}
    </>
  );
}

type FollowedListMeta = {
  list_id: string;
  name: string;
  channel_count: number;
};

async function ChannelsSheetSection({ userId }: { userId: string }) {
  const profile = await getProfile(userId);
  if (!profile) return null;

  const supabase = await createClient();
  const [{ data: sources }, { data: listFollows }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .or("source_type.is.null,source_type.eq.youtube_channel")
      .order("created_at", { ascending: false }),
    supabase
      .from("list_follows")
      .select(
        "list_id, channel_lists(id, name, category, list_channels(count))",
      )
      .eq("user_id", userId)
      .order("followed_at", { ascending: false }),
  ]);

  const followedLists: FollowedListMeta[] = (listFollows ?? []).map((item) => {
    const listData = item.channel_lists as {
      id: string;
      name: string;
      category: string | null;
      list_channels: { count: number }[];
    } | null;
    const count =
      (listData?.list_channels as { count: number }[] | undefined)?.[0]
        ?.count ?? 0;
    return {
      list_id: item.list_id,
      name: listData?.name ?? "Unknown",
      channel_count: count,
    };
  });

  const isPro =
    profile.subscription_status === "active" ||
    (profile.trial_ends_at != null &&
      new Date(profile.trial_ends_at) > new Date());
  const maxChannels = profile.max_channels ?? SiteConfig.freeChannelsLimit;

  return (
    <ChannelsSheet
      initialSources={sources ?? []}
      followedLists={followedLists}
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
    for (const d of deliveryData) {
      const video = (videoMap[`${d.video_id}:${d.language}`] ??
        videoMap[d.video_id]) as ProcessedVideo | undefined;
      if (!video) continue;
      initialDeliveries.push({ ...d, video });
    }
  }

  // Show demo summaries for new users with an empty feed
  if (initialDeliveries.length === 0) {
    const demoIds = DEMO_DELIVERIES.map((d) => d.video_id);
    const { data: demoVideos } = await supabase
      .from("processed_videos")
      .select(
        "video_id, video_title, video_url, summary, audio_url, channel_id, status",
      )
      .in("video_id", demoIds)
      .eq("language", "en");

    const demoMap: Record<string, ProcessedVideo> = {};
    for (const v of demoVideos ?? []) {
      demoMap[v.video_id] = v;
    }

    initialDeliveries = DEMO_DELIVERIES.map((d) => ({
      ...d,
      video: demoMap[d.video_id] ?? d.video,
    }));
  }

  const preferredLang = profile.preferred_language ?? "en";
  const initialFavLangs = [
    ...new Set([...profile.favorite_languages, preferredLang]),
  ];

  // Preload channel subscription states for Active/Paused badges
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("id, channel_id, active, channel_avatar_url")
    .eq("user_id", userId);
  const initialChannelStates: Record<
    string,
    { active: boolean; subId: string; avatarUrl: string | null }
  > = {};
  for (const s of subs ?? []) {
    initialChannelStates[s.channel_id] = {
      active: !!s.active,
      subId: s.id,
      avatarUrl: s.channel_avatar_url,
    };
  }

  return (
    <SummariesFeed
      initialDeliveries={initialDeliveries}
      initialPreferredLang={preferredLang}
      initialFavLangs={initialFavLangs}
      initialChannelStates={initialChannelStates}
      headerRight={
        <>
          <Suspense
            fallback={
              <div className="h-8 w-16 animate-pulse rounded-md bg-white/[0.06]" />
            }
          >
            <ChannelsSheetSection userId={userId} />
          </Suspense>
          <StatsSheet />
        </>
      }
      banners={
        <>
          <PendingVideoPickup />
          <ProcessingVideoCard />
        </>
      }
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
    <div className="flex flex-col gap-3">
      <Suspense fallback={null}>
        <DashboardBanners userId={user.id} />
      </Suspense>
      <Suspense fallback={null}>
        <VideoHighlighter />
      </Suspense>
      <Suspense fallback={null}>
        <PushNotificationBanner />
      </Suspense>
      <PendingVideoProcessor />
      <SectionErrorBoundary>
        <Suspense fallback={<SummariesFeedSkeleton />}>
          <FeedSection userId={user.id} />
        </Suspense>
      </SectionErrorBoundary>
    </div>
  );
}
