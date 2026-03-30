import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { WorkerCard } from "@/components/admin/worker-card";
import { getStripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import {
  Users,
  MessageCircle,
  Zap,
  CheckCircle,
  XCircleIcon,
  Send,
  Loader2,
  Activity,
  AlertCircle,
  Clock,
  TrendingUp,
  Mail,
} from "@/lib/icons";
import { ServicesHealth } from "@/components/admin/services-health";
import {
  getPostHogTotalVisitors,
  getPostHogDailyVisitors,
  type DailyVisitorCount,
} from "@/lib/posthog-server";

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

type StatCardProps = {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger";
};

function StatCard({
  label,
  value,
  sub,
  icon,
  variant = "default",
}: StatCardProps) {
  const accent =
    variant === "success"
      ? "text-emerald-400"
      : variant === "warning"
        ? "text-yellow-400"
        : variant === "danger"
          ? "text-red-400"
          : "text-foreground";

  return (
    <div className="nm-raised flex flex-col gap-3 rounded-xl px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
        <div className="text-muted-foreground/40">{icon}</div>
      </div>
      <div>
        <p className={`text-2xl font-bold tabular-nums ${accent}`}>{value}</p>
        {sub && (
          <p className="text-muted-foreground mt-0.5 text-[11px]">{sub}</p>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-muted-foreground/50 px-1 text-xs font-medium tracking-wide uppercase">
      {children}
    </h2>
  );
}

// ---------------------------------------------------------------
// Explicit types for columns not in generated Supabase types
// ---------------------------------------------------------------

type PendingVideo = {
  video_id: string;
  channel_id: string;
  language: string;
  created_at: string;
  status: string;
};

type FailedVideo = {
  video_id: string;
  channel_id: string;
  language: string;
  created_at: string;
  failure_count: number;
  metadata: { error?: string } | null;
};

type ExpiringTrial = {
  id: string;
  email: string;
  trial_ends_at: string;
};

type AtRiskUser = {
  id: string;
  email: string;
};

type CancellationFeedbackRow = {
  id: string;
  reason: string;
  custom_message: string | null;
  offer_accepted: boolean;
  created_at: string;
};

type EmailLogRow = { email_type: string | null; created_at: string | null };
type EmailTypeStats = {
  total: number;
  last30d: number;
  lastSentAt: string | null;
};

// ---------------------------------------------------------------
// Growth helpers
// ---------------------------------------------------------------

type DailyCount = { label: string; count: number };

function buildDailyArray(
  data: { created_at?: string | null }[],
  days: number,
): DailyCount[] {
  const now = new Date();
  const result = Array.from({ length: days }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (days - 1 - i));
    return {
      label: d.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
      }),
      count: 0,
    };
  });
  for (const item of data) {
    const created = new Date(item.created_at ?? "");
    const dayIndex =
      days - 1 - Math.floor((now.getTime() - created.getTime()) / 86400000);
    if (dayIndex >= 0 && dayIndex < days) {
      result[dayIndex].count++;
    }
  }
  return result;
}

function mergeDailyVisitors(
  visitorData: DailyVisitorCount[],
  days: number,
): DailyCount[] {
  const now = new Date();
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (days - 1 - i));
    const dateStr = d.toISOString().slice(0, 10);
    const match = visitorData.find((v) => v.date === dateStr);
    return {
      label: d.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
      }),
      count: match?.count ?? 0,
    };
  });
}

function FunnelStep({
  label,
  value,
  sub,
  variant = "default",
}: {
  label: string;
  value: string | number;
  sub?: string;
  variant?: "default" | "success" | "warning" | "muted";
}) {
  const valueColor =
    variant === "success"
      ? "text-emerald-400"
      : variant === "warning"
        ? "text-yellow-400"
        : variant === "muted"
          ? "text-muted-foreground/40"
          : "text-foreground";
  return (
    <div className="nm-raised flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-3 text-center">
      <p className="text-muted-foreground text-[10px] leading-tight font-medium">
        {label}
      </p>
      <p className={`text-lg font-bold tabular-nums ${valueColor}`}>{value}</p>
      {sub && <p className="text-muted-foreground/50 text-[9px]">{sub}</p>}
    </div>
  );
}

function FunnelArrow({
  rate,
  active = true,
}: {
  rate: string;
  active?: boolean;
}) {
  const rateNum = parseFloat(rate);
  const rateColor = !active
    ? "text-muted-foreground/20"
    : rateNum >= 20
      ? "text-emerald-400"
      : rateNum >= 5
        ? "text-yellow-400"
        : "text-red-400";
  return (
    <div className="flex shrink-0 flex-col items-center justify-center gap-0.5 pt-3">
      <span className={`text-[11px] font-semibold tabular-nums ${rateColor}`}>
        {rate}
      </span>
      <span className="text-xs text-white/15">›</span>
    </div>
  );
}

function MiniBarChart({
  title,
  days,
  total,
  accentColor = "bg-red-500/50",
  hoverColor = "group-hover:bg-red-500/80",
  unavailable = false,
}: {
  title: string;
  days: DailyCount[];
  total?: number | string | null;
  accentColor?: string;
  hoverColor?: string;
  unavailable?: boolean;
}) {
  const maxCount = Math.max(...days.map((d) => d.count), 1);
  return (
    <div className="nm-raised flex flex-col gap-2 rounded-xl px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-[11px] font-medium">{title}</p>
        {total !== undefined && total !== null && (
          <span className="text-foreground text-xs font-semibold tabular-nums">
            {total}
          </span>
        )}
      </div>
      {unavailable ? (
        <div className="flex h-[40px] items-center justify-center">
          <p className="text-muted-foreground/30 text-center text-[9px] leading-relaxed">
            Configurer
            <br />
            POSTHOG_PERSONAL_API_KEY
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-end gap-0.5" style={{ height: "40px" }}>
            {days.map((d, i) => (
              <div
                key={i}
                className="group relative flex flex-1 flex-col items-center justify-end"
                style={{ height: "40px" }}
              >
                <div
                  className={`w-full rounded-sm transition-all ${accentColor} ${hoverColor}`}
                  style={{
                    height: `${Math.max(
                      Math.round((d.count / maxCount) * 100),
                      d.count > 0 ? 8 : 2,
                    )}%`,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground text-[9px]">
              {days[0]?.label}
            </span>
            <span className="text-muted-foreground text-[9px]">
              {days[days.length - 1]?.label}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// Page
// ---------------------------------------------------------------

export default async function AdminPage() {
  // Auth guard — use user client to verify session
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!env.ADMIN_USER_ID || user?.id !== env.ADMIN_USER_ID) {
    redirect("/dashboard");
  }

  // All data queries use admin client to bypass RLS
  const admin = createAdminClient();

  // Compute all dates upfront
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  const since24h = oneDayAgo.toISOString();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString();

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const fourteenDaysAgoStr = fourteenDaysAgo.toISOString();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

  const now = new Date().toISOString();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  const sevenDaysFromNowStr = sevenDaysFromNow.toISOString();

  // MASSIVE PARALLEL BATCH: 18+ independent queries
  const [
    // Batch 1: Core stats
    { count: totalUsers },
    { count: telegramConnected },
    { count: proUsers },
    { count: activeSubscriptions },
    { data: videosToday },
    { data: deliveriesToday },
    { count: totalCompleted },
    // Batch 2: Platform, queue, failed, transcripts
    { data: platformConnsRaw },
    { data: pendingQueueRaw },
    { data: recentFailedRaw },
    { data: transcriptSourcesRaw },
    // Batch 3: Funnel
    { count: trialActive },
    { count: trialExpired },
    { count: freeNoTrial },
    { count: churned },
    { data: expiringTrialsRaw },
    // Item 4: Stripe price (independent)
    stripePrice,
    // Batch 5: Active deliveries, signups
    { data: activeDeliveries },
    { data: recentSignups },
    // Items 6-9: Referrals (2 queries)
    { count: totalReferrals },
    { data: referralData },
    // Item 10: Languages
    { data: langData },
    // Item 11: Top channels
    { data: allActiveSubs },
    // Item 12: Cancellation feedbacks
    { data: cancellationFeedbacksRaw },
    // Item 13-14: PostHog
    visitorsTotal30d,
    visitorDailyRaw,
    // Item 15-16: Trends (signups & trials 30d)
    { data: signupsRaw30d },
    { data: trialStartsRaw30d },
    // Item 17: Email logs
    { data: emailLogsRaw },
    // Item 18: Email open rates
    { count: emailsOpened30d },
    // Item 19-22: Onboarding batch
    { data: usersWithChannelsResult },
    { count: importSubCount },
    { count: listFollowSubCount },
    { count: onboardedCount },
    // Item 23: activeSubs (needed for atRiskUsers conditional)
    { data: activeSubs },
  ] = await Promise.all([
    // Batch 1: Core stats
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("telegram_connected", true),
    admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("subscription_status", "active"),
    admin
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("active", true),
    admin
      .from("processed_videos")
      .select("video_id, status")
      .gte("created_at", since24h),
    admin.from("deliveries").select("status").gte("created_at", since24h),
    admin
      .from("processed_videos")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed"),
    // Batch 2: Platform, queue, failed, transcripts
    admin.from("platform_connections").select("user_id").eq("connected", true),
    admin
      .from("processed_videos")
      .select("video_id, channel_id, language, created_at, status")
      .in("status", ["pending", "processing"])
      .order("created_at", { ascending: true }),
    admin
      .from("processed_videos")
      .select(
        "video_id, channel_id, language, created_at, failure_count, metadata",
      )
      .eq("status", "failed")
      .gte("created_at", sevenDaysAgoStr)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("processed_videos")
      .select("transcript_source, transcript_cost")
      .eq("status", "completed")
      .gte("created_at", since24h)
      .not("transcript_source", "is", null),
    // Batch 3: Funnel
    admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("subscription_status", "free")
      .gt("trial_ends_at", now),
    admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("subscription_status", "free")
      .not("trial_ends_at", "is", null)
      .lt("trial_ends_at", now),
    admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("subscription_status", "free")
      .is("trial_ends_at", null),
    admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .in("subscription_status", ["cancelled", "past_due"]),
    admin
      .from("profiles")
      .select("id, email, trial_ends_at")
      .eq("subscription_status", "free")
      .gt("trial_ends_at", now)
      .lt("trial_ends_at", sevenDaysFromNowStr)
      .order("trial_ends_at", { ascending: true })
      .limit(10),
    // Stripe price (wrapped in try/catch)
    (async () => {
      try {
        const stripe = getStripe();
        const price = await stripe.prices.retrieve(env.STRIPE_PRO_PRICE_ID);
        return price.unit_amount ?? 0;
      } catch {
        return 0;
      }
    })(),
    // Batch 5: Active deliveries, signups
    admin
      .from("deliveries")
      .select("user_id")
      .eq("status", "sent")
      .gte("created_at", sevenDaysAgoStr),
    admin
      .from("profiles")
      .select("created_at")
      .gte("created_at", fourteenDaysAgoStr)
      .order("created_at", { ascending: true }),
    // Items 6-9: Referrals
    admin.from("referrals").select("*", { count: "exact", head: true }),
    admin.from("referrals").select("referee_id"),
    // Item 10: Languages
    admin.from("profiles").select("preferred_language"),
    // Item 11: Top channels
    admin
      .from("subscriptions")
      .select("channel_id, channel_name")
      .eq("active", true),
    // Item 12: Cancellation feedbacks
    admin
      .from("cancellation_feedbacks")
      .select("id, reason, custom_message, offer_accepted, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    // Item 13-14: PostHog
    getPostHogTotalVisitors(30),
    getPostHogDailyVisitors(30),
    // Item 15-16: Trends (signups & trials 30d)
    admin
      .from("profiles")
      .select("created_at")
      .gte("created_at", thirtyDaysAgoStr),
    admin
      .from("profiles")
      .select("created_at")
      .not("trial_ends_at", "is", null)
      .gte("created_at", thirtyDaysAgoStr),
    // Item 17: Email logs
    admin.from("email_logs").select("email_type, created_at"),
    // Item 18: Email open rates
    admin
      .from("email_logs")
      .select("*", { count: "exact", head: true })
      .gte("sent_at", thirtyDaysAgoStr)
      .not("opened_at", "is", null),
    // Item 19-22: Onboarding batch
    admin.rpc("count_users_with_channels" as never),
    admin
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("source_type", "youtube_import"),
    admin
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("source_type", "list_follow"),
    admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("onboarding_completed", true),
    // Item 23: activeSubs (needed for atRiskUsers conditional)
    admin.from("subscriptions").select("user_id").eq("active", true),
  ]);

  // Process results
  const platformConnected = new Set(
    (platformConnsRaw ?? []).map((r) => r.user_id),
  ).size;
  const pendingQueue = pendingQueueRaw as unknown as PendingVideo[] | null;
  const recentFailed = recentFailedRaw as unknown as FailedVideo[] | null;

  const expiringTrials = (expiringTrialsRaw ?? []) as ExpiringTrial[];

  const monthlyPriceCents = stripePrice as number;

  // Compute stats — Partial<Record> so values are number | undefined → ?? 0 is valid
  const videosByStatus = (videosToday ?? []).reduce<
    Partial<Record<string, number>>
  >((acc, v) => {
    if (!v.status) return acc;
    acc[v.status] = (acc[v.status] ?? 0) + 1;
    return acc;
  }, {});

  const deliveriesByStatus = (deliveriesToday ?? []).reduce<
    Partial<Record<string, number>>
  >((acc, d) => {
    if (!d.status) return acc;
    acc[d.status] = (acc[d.status] ?? 0) + 1;
    return acc;
  }, {});

  // Count distinct video_ids (a video processed in 2 languages = 1 unique video)
  const videosCompleted24h = new Set(
    (videosToday ?? [])
      .filter((v) => v.status === "completed")
      .map((v) => (v as { video_id?: string }).video_id),
  ).size;
  const videosFailed24h = new Set(
    (videosToday ?? [])
      .filter((v) => v.status === "failed")
      .map((v) => (v as { video_id?: string }).video_id),
  ).size;
  const videosSkipped24h = videosByStatus.skipped ?? 0;
  const deliveriesSent24h = deliveriesByStatus.sent ?? 0;
  const deliveriesFailed24h = deliveriesByStatus.failed ?? 0;

  // Pipeline breakdown
  const TEXT_SOURCES = [
    "youtube_api",
    "invidious",
    "piped",
    "youtube-transcript-api",
    "youtube",
    "manual",
  ];
  const AUDIO_SOURCES = ["groq", "whisper", "yt-dlp"];

  type TranscriptSourceRaw = {
    transcript_source: string | null;
    transcript_cost: number | null;
  };

  const transcriptSourceStats = (
    (transcriptSourcesRaw as TranscriptSourceRaw[] | null) ?? []
  ).reduce<Record<string, { count: number; cost: number }>>((acc, v) => {
    const src = (v.transcript_source as string | null) ?? "unknown";
    const cost = (v.transcript_cost as number | null) ?? 0;
    acc[src] ??= { count: 0, cost: 0 };
    acc[src].count++;
    acc[src].cost += cost;
    return acc;
  }, {});

  const textSourcesTotal = Object.entries(transcriptSourceStats)
    .filter(([src]) => TEXT_SOURCES.includes(src))
    .reduce((s, [, v]) => s + v.count, 0);

  const audioSourcesTotal = Object.entries(transcriptSourceStats)
    .filter(([src]) => AUDIO_SOURCES.includes(src))
    .reduce((s, [, v]) => s + v.count, 0);

  const totalTranscripts24h = textSourcesTotal + audioSourcesTotal;

  // Failure reasons breakdown (7 days)
  type FailedVideoRaw = {
    metadata: { error?: string } | null;
  };

  const failureReasons = (
    (recentFailed as FailedVideoRaw[] | null) ?? []
  ).reduce<Record<string, number>>((acc, v) => {
    const reason = v.metadata?.error ?? "(unknown)";
    acc[reason] = (acc[reason] ?? 0) + 1;
    return acc;
  }, {});
  const failureReasonEntries = Object.entries(failureReasons).sort(
    ([, a], [, b]) => b - a,
  );

  const total = totalUsers ?? 0;
  const platformPct =
    total > 0 ? Math.round((platformConnected / total) * 100) : 0;

  const proCount = proUsers ?? 0;
  const trialExpiredCount = trialExpired ?? 0;
  const trialsStarted = proCount + trialExpiredCount;
  const conversionRate =
    trialsStarted > 0 ? Math.round((proCount / trialsStarted) * 100) : 0;

  const mrr = Math.round((proCount * monthlyPriceCents) / 100);

  const activeUsersCount = new Set(
    (activeDeliveries ?? []).map((d) => d.user_id),
  ).size;

  // Build 14-day array
  const signupDays: { label: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    signupDays.push({
      label: d.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
      }),
      count: 0,
    });
  }
  (recentSignups ?? []).forEach((p) => {
    const pDate = new Date(p.created_at ?? "");
    const dayIndex =
      13 - Math.floor((new Date().getTime() - pDate.getTime()) / 86400000);
    if (dayIndex >= 0 && dayIndex < 14) {
      signupDays[dayIndex].count++;
    }
  });
  const maxSignups = Math.max(...signupDays.map((d) => d.count), 1);
  const totalSignups14d = signupDays.reduce((s, d) => s + d.count, 0);

  const refereeIds = [
    ...new Set((referralData ?? []).map((r) => r.referee_id)),
  ];

  const langCounts = (langData ?? []).reduce<Record<string, number>>(
    (acc, p) => {
      const lang = p.preferred_language ?? "unknown";
      acc[lang] = (acc[lang] ?? 0) + 1;
      return acc;
    },
    {},
  );
  const topLanguages = Object.entries(langCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const channelMap = (allActiveSubs ?? []).reduce<
    Record<string, { name: string; count: number }>
  >((acc, s) => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!acc[s.channel_id]) {
      acc[s.channel_id] = { name: s.channel_name, count: 0 };
    } else if (
      acc[s.channel_id].name === s.channel_id &&
      s.channel_name !== s.channel_id
    ) {
      // Remplace un ID stocké comme nom par un vrai nom si on en trouve un
      acc[s.channel_id].name = s.channel_name;
    }
    acc[s.channel_id].count++;
    return acc;
  }, {});
  const topChannels = Object.entries(channelMap)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([id, data]) => ({ id, name: data.name, count: data.count }));

  const cancellationFeedbacks =
    (cancellationFeedbacksRaw as unknown as CancellationFeedbackRow[] | null) ??
    [];
  const offersAccepted = cancellationFeedbacks.filter(
    (f) => f.offer_accepted,
  ).length;

  const visitorDays30d = visitorDailyRaw
    ? mergeDailyVisitors(visitorDailyRaw, 30)
    : null;

  const signupDays30d = buildDailyArray(signupsRaw30d ?? [], 30);
  const trialStartDays30d = buildDailyArray(trialStartsRaw30d ?? [], 30);
  const newSignups30d = signupDays30d.reduce((s, d) => s + d.count, 0);
  const newTrials30d = trialStartDays30d.reduce((s, d) => s + d.count, 0);

  const emailLogs = (emailLogsRaw as unknown as EmailLogRow[] | null) ?? [];
  const thirtyDaysAgoTs = thirtyDaysAgoStr;

  const emailTypeStatsPartial: Partial<Record<string, EmailTypeStats>> = {};
  for (const log of emailLogs) {
    const type = log.email_type ?? "unknown";
    const inLast30d = !!(log.created_at && log.created_at >= thirtyDaysAgoTs);
    const entry = emailTypeStatsPartial[type];
    if (entry === undefined) {
      emailTypeStatsPartial[type] = {
        total: 1,
        last30d: inLast30d ? 1 : 0,
        lastSentAt: log.created_at,
      };
    } else {
      entry.total++;
      if (inLast30d) entry.last30d++;
      const curr = log.created_at;
      if (curr && (!entry.lastSentAt || curr > entry.lastSentAt)) {
        entry.lastSentAt = curr;
      }
    }
  }
  const emailTypeStats = emailTypeStatsPartial as Record<
    string,
    EmailTypeStats
  >;
  const totalEmailsSent30d = Object.values(emailTypeStats).reduce(
    (s, v) => s + v.last30d,
    0,
  );

  const emailOpenRate =
    totalEmailsSent30d > 0
      ? Math.round(((emailsOpened30d ?? 0) / totalEmailsSent30d) * 100)
      : 0;

  const usersWithChannels = (usersWithChannelsResult as unknown as number) || 0;
  const totalSubCount = activeSubscriptions ?? 0;
  const importSubs = importSubCount ?? 0;
  const listFollowSubs = listFollowSubCount ?? 0;
  const manualSubs = Math.max(0, totalSubCount - importSubs - listFollowSubs);
  const onboardingRate =
    total > 0 ? Math.round(((onboardedCount ?? 0) / total) * 100) : 0;

  // ── Utilisateurs à risque — DEPENDENT on activeSubs ──────────────────
  const activeSubUserIds = [
    ...new Set((activeSubs ?? []).map((s) => s.user_id)),
  ];

  let atRiskUsers: AtRiskUser[] = [];
  if (activeSubUserIds.length > 0) {
    const [{ data: proCandidates }, { data: recentSent }] = await Promise.all([
      admin
        .from("profiles")
        .select("id, email")
        .eq("subscription_status", "active")
        .in("id", activeSubUserIds),
      admin
        .from("deliveries")
        .select("user_id")
        .eq("status", "sent")
        .gte("created_at", sevenDaysAgoStr)
        .in("user_id", activeSubUserIds),
    ]);
    const recentIds = new Set((recentSent ?? []).map((d) => d.user_id));
    atRiskUsers = ((proCandidates ?? []) as AtRiskUser[]).filter(
      (u) => !recentIds.has(u.id),
    );
  }

  // ── Converted referrals — DEPENDENT on referralData ────────────────────
  let convertedReferrals = 0;
  if (refereeIds.length > 0) {
    const { count } = await admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("subscription_status", "active")
      .in("id", refereeIds);
    convertedReferrals = count ?? 0;
  }
  const referralConversionRate =
    (totalReferrals ?? 0) > 0
      ? Math.round((convertedReferrals / (totalReferrals ?? 1)) * 100)
      : 0;

  // ── Taux de conversion funnel ─────────────────────────────────
  const allTrialUsers = (trialActive ?? 0) + trialExpiredCount + proCount;
  const visitorToSignupRatePct =
    visitorsTotal30d && visitorsTotal30d > 0
      ? (newSignups30d / visitorsTotal30d) * 100
      : null;
  const signupToTrialPct = total > 0 ? (allTrialUsers / total) * 100 : 0;
  const trialToActivatedPct =
    allTrialUsers > 0 ? (usersWithChannels / allTrialUsers) * 100 : 0;
  const activatedToProPct =
    usersWithChannels > 0 ? (proCount / usersWithChannels) * 100 : 0;
  const activationRate =
    allTrialUsers > 0
      ? Math.round((usersWithChannels / allTrialUsers) * 100)
      : 0;

  const fmtPct = (n: number) =>
    n < 1 ? `${n.toFixed(1)}%` : `${Math.round(n)}%`;

  return (
    <div className="flex flex-col gap-6">
      <AdminBreadcrumb />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Monitoring</h1>
          <p className="text-muted-foreground text-xs">
            Pilotage du worker & analytics
          </p>
        </div>
        <div className="nm-raised-sm flex items-center gap-1.5 rounded-lg px-3 py-1.5">
          <Activity className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-xs font-medium text-emerald-400">Live</span>
          <span className="text-muted-foreground text-xs">· 10s</span>
        </div>
      </div>

      {/* Funnel d'acquisition */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <SectionTitle>Funnel d'acquisition</SectionTitle>
          <span className="text-muted-foreground text-xs">
            visiteurs 30j · users cumulatifs
          </span>
        </div>
        <div className="nm-raised overflow-hidden rounded-xl p-4">
          <div className="flex items-start gap-1.5">
            <FunnelStep
              label="Visiteurs"
              value={
                visitorsTotal30d !== null
                  ? visitorsTotal30d.toLocaleString("fr-FR")
                  : "—"
              }
              sub="30 jours"
              variant={visitorsTotal30d !== null ? "default" : "muted"}
            />
            <FunnelArrow
              rate={
                visitorToSignupRatePct !== null
                  ? fmtPct(visitorToSignupRatePct)
                  : "—"
              }
              active={visitorToSignupRatePct !== null}
            />
            <FunnelStep
              label="Inscrits"
              value={total}
              sub="total"
              variant="default"
            />
            <FunnelArrow rate={fmtPct(signupToTrialPct)} />
            <FunnelStep
              label="Ont trialé"
              value={allTrialUsers}
              sub="actifs + expirés"
              variant="warning"
            />
            <FunnelArrow rate={fmtPct(trialToActivatedPct)} />
            <FunnelStep
              label="Ajouté chaînes"
              value={usersWithChannels}
              sub={`${activationRate}% des trials`}
              variant={activationRate >= 50 ? "success" : "warning"}
            />
            <FunnelArrow rate={fmtPct(activatedToProPct)} />
            <FunnelStep
              label="Pro payant"
              value={proCount}
              sub="abonnés actifs"
              variant="success"
            />
          </div>
          {visitorsTotal30d === null && (
            <p className="text-muted-foreground/40 mt-3 text-[10px]">
              Données visiteurs indisponibles — configurer{" "}
              <code className="font-mono">POSTHOG_PERSONAL_API_KEY</code> +{" "}
              <code className="font-mono">POSTHOG_PROJECT_ID</code>
            </p>
          )}
        </div>
      </div>

      {/* Tendances 30 jours */}
      <div className="flex flex-col gap-2">
        <SectionTitle>Tendances — 30 jours</SectionTitle>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <MiniBarChart
            title="Visiteurs / jour"
            days={visitorDays30d ?? []}
            total={
              visitorsTotal30d !== null
                ? visitorsTotal30d.toLocaleString("fr-FR")
                : null
            }
            unavailable={visitorDays30d === null}
            accentColor="bg-sky-500/50"
            hoverColor="group-hover:bg-sky-500/80"
          />
          <MiniBarChart
            title="Inscrits / jour"
            days={signupDays30d}
            total={newSignups30d}
            accentColor="bg-red-500/50"
            hoverColor="group-hover:bg-red-500/80"
          />
          <MiniBarChart
            title="Trials démarrés / jour"
            days={trialStartDays30d}
            total={newTrials30d}
            accentColor="bg-yellow-500/50"
            hoverColor="group-hover:bg-yellow-500/80"
          />
        </div>
      </div>

      {/* Users stats */}
      <div className="flex flex-col gap-2">
        <SectionTitle>Utilisateurs</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard
            label="Total inscrits"
            value={totalUsers ?? 0}
            icon={<Users className="h-4 w-4" />}
          />
          <StatCard
            label="Plateforme connectée"
            value={platformConnected}
            sub={`${platformPct}% des users · ${telegramConnected ?? 0} Telegram`}
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
            }
            variant={platformPct >= 50 ? "success" : "warning"}
          />
          <StatCard
            label="Abonnés Pro"
            value={proUsers ?? 0}
            icon={<Zap className="h-4 w-4" />}
            variant={proUsers ? "success" : "default"}
          />
          <StatCard
            label="Abonnements actifs"
            value={activeSubscriptions ?? 0}
            sub="chaînes suivies"
            icon={<Activity className="h-4 w-4" />}
          />
        </div>
      </div>

      {/* Funnel de conversion */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <SectionTitle>Funnel de conversion</SectionTitle>
          <span
            className={`nm-raised-sm rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums ${
              conversionRate >= 20
                ? "text-emerald-400"
                : conversionRate >= 10
                  ? "text-yellow-400"
                  : "text-muted-foreground"
            }`}
          >
            {conversionRate}% converti
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <StatCard
            label="Free (jamais trial)"
            value={freeNoTrial ?? 0}
            icon={<Users className="h-4 w-4" />}
          />
          <StatCard
            label="Trial actif"
            value={trialActive ?? 0}
            icon={<Clock className="h-4 w-4" />}
            variant="warning"
          />
          <StatCard
            label="Trial expiré"
            value={trialExpiredCount}
            sub="n'ont pas converti"
            icon={<XCircleIcon className="h-4 w-4" />}
            variant={trialExpiredCount > 0 ? "danger" : "default"}
          />
          <StatCard
            label="Pro actif"
            value={proCount}
            icon={<Zap className="h-4 w-4" />}
            variant="success"
          />
          <StatCard
            label="Churned"
            value={churned ?? 0}
            sub="annulé / impayé"
            icon={<AlertCircle className="h-4 w-4" />}
            variant={(churned ?? 0) > 0 ? "danger" : "default"}
          />
        </div>

        {/* Trials expirant bientôt */}
        {expiringTrials.length > 0 && (
          <div className="nm-raised overflow-hidden rounded-xl">
            <div className="flex items-center gap-2 border-b border-white/[0.04] px-4 py-2">
              <Clock className="text-muted-foreground/40 h-3.5 w-3.5" />
              <p className="text-muted-foreground text-xs font-medium">
                Trials expirant dans 7 jours ({expiringTrials.length})
              </p>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {expiringTrials.map((t) => {
                const daysLeft = Math.ceil(
                  (new Date(t.trial_ends_at).getTime() - new Date().getTime()) /
                    86400000,
                );
                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between px-4 py-2"
                  >
                    <p className="text-sm">{t.email}</p>
                    <span
                      className={`text-xs font-medium tabular-nums ${
                        daysLeft <= 2 ? "text-red-400" : "text-yellow-400"
                      }`}
                    >
                      J-{daysLeft}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Activation & Engagement */}
      <div className="flex flex-col gap-2">
        <SectionTitle>Activation & Engagement</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard
            label="Ont ajouté des chaînes"
            value={usersWithChannels}
            sub={`${activationRate}% des inscrits`}
            icon={<CheckCircle className="h-4 w-4" />}
            variant={
              activationRate >= 50
                ? "success"
                : activationRate >= 20
                  ? "warning"
                  : "danger"
            }
          />
          <StatCard
            label="Onboarding complété"
            value={onboardedCount ?? 0}
            sub={`${onboardingRate}% des inscrits`}
            icon={<CheckCircle className="h-4 w-4" />}
            variant={
              onboardingRate >= 50
                ? "success"
                : onboardingRate >= 20
                  ? "warning"
                  : "danger"
            }
          />
          <StatCard
            label="Open rate emails"
            value={`${emailOpenRate}%`}
            sub={`${emailsOpened30d ?? 0}/${totalEmailsSent30d} (30j)`}
            icon={<Mail className="h-4 w-4" />}
            variant={
              emailOpenRate >= 20
                ? "success"
                : emailOpenRate >= 10
                  ? "warning"
                  : "danger"
            }
          />
          <StatCard
            label="Actifs 7j"
            value={activeUsersCount}
            sub={`${total > 0 ? Math.round((activeUsersCount / total) * 100) : 0}% des users`}
            icon={<Activity className="h-4 w-4" />}
            variant={activeUsersCount > 0 ? "success" : "default"}
          />
        </div>

        {/* Source des chaînes */}
        <div className="nm-raised overflow-hidden rounded-xl">
          <div className="border-b border-white/[0.04] px-4 py-2.5">
            <p className="text-xs font-medium">Source des chaînes ajoutées</p>
          </div>
          <div className="grid grid-cols-3 divide-x divide-white/[0.04]">
            <div className="flex flex-col gap-1 px-4 py-3">
              <p className="text-muted-foreground text-[11px]">Manuel</p>
              <p className="text-xl font-bold tabular-nums">{manualSubs}</p>
              <p className="text-muted-foreground/50 text-[9px]">chaînes</p>
            </div>
            <div className="flex flex-col gap-1 px-4 py-3">
              <p className="text-muted-foreground text-[11px]">
                Import YouTube
              </p>
              <p className="text-xl font-bold text-sky-400 tabular-nums">
                {importSubs}
              </p>
              <p className="text-muted-foreground/50 text-[9px]">chaînes</p>
            </div>
            <div className="flex flex-col gap-1 px-4 py-3">
              <p className="text-muted-foreground text-[11px]">
                Suivi de liste
              </p>
              <p className="text-xl font-bold text-amber-400 tabular-nums">
                {listFollowSubs}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Revenus */}
      <div className="flex flex-col gap-2">
        <SectionTitle>Revenus</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <StatCard
            label="MRR estimé"
            value={mrr > 0 ? `$${mrr}` : "—"}
            sub={
              mrr > 0
                ? `${proCount} × $${Math.round(monthlyPriceCents / 100)}/mois`
                : "Stripe non configuré"
            }
            icon={<TrendingUp className="h-4 w-4" />}
            variant={mrr > 0 ? "success" : "default"}
          />
          <StatCard
            label="Actifs 7j"
            value={activeUsersCount}
            sub={`${total > 0 ? Math.round((activeUsersCount / total) * 100) : 0}% des users`}
            icon={<Activity className="h-4 w-4" />}
            variant={activeUsersCount > 0 ? "success" : "default"}
          />
          <StatCard
            label="Inscrits 14j"
            value={totalSignups14d}
            sub="nouveaux utilisateurs"
            icon={<Users className="h-4 w-4" />}
            variant={totalSignups14d > 0 ? "success" : "default"}
          />
        </div>
      </div>

      {/* Activity 24h */}
      <div className="flex flex-col gap-2">
        <SectionTitle>Activité 24h</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard
            label="Vidéos traitées"
            value={videosCompleted24h}
            sub={`${totalCompleted ?? 0} au total`}
            icon={<CheckCircle className="h-4 w-4" />}
            variant="success"
          />
          <StatCard
            label="Vidéos échouées"
            value={videosFailed24h}
            sub={`${videosSkipped24h} skipped`}
            icon={<XCircleIcon className="h-4 w-4" />}
            variant={videosFailed24h > 0 ? "danger" : "default"}
          />
          <StatCard
            label="Livraisons envoyées"
            value={deliveriesSent24h}
            icon={<Send className="h-4 w-4" />}
            variant={deliveriesSent24h > 0 ? "success" : "default"}
          />
          <StatCard
            label="Non délivrés"
            value={deliveriesFailed24h}
            sub="bot bloqué / injoignable"
            icon={<MessageCircle className="h-4 w-4" />}
            variant={deliveriesFailed24h > 0 ? "warning" : "default"}
          />
        </div>
      </div>

      {/* Croissance + Parrainage */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Croissance */}
        <div className="flex flex-col gap-2">
          <SectionTitle>Croissance — 14 jours</SectionTitle>
          <div className="nm-raised rounded-xl px-4 py-3">
            <div
              className="mb-2 flex items-end gap-0.5"
              style={{ height: "48px" }}
            >
              {signupDays.map((d, i) => (
                <div
                  key={i}
                  className="group relative flex flex-1 flex-col items-center justify-end"
                  style={{ height: "48px" }}
                >
                  <div
                    className="w-full rounded-sm bg-red-500/50 transition-all group-hover:bg-red-500/80"
                    style={{
                      height: `${Math.max(Math.round((d.count / maxSignups) * 100), d.count > 0 ? 15 : 4)}%`,
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-[10px]">
                {signupDays[0]?.label}
              </span>
              <span className="text-muted-foreground text-[10px]">
                {signupDays[13]?.label}
              </span>
            </div>
          </div>
        </div>

        {/* Parrainage */}
        <div className="flex flex-col gap-2">
          <SectionTitle>Parrainage</SectionTitle>
          <div className="nm-raised overflow-hidden rounded-xl">
            <div className="grid grid-cols-3 divide-x divide-white/[0.04]">
              <div className="flex flex-col gap-1 px-4 py-3">
                <p className="text-muted-foreground text-[11px]">Total</p>
                <p className="text-xl font-bold tabular-nums">
                  {totalReferrals ?? 0}
                </p>
              </div>
              <div className="flex flex-col gap-1 px-4 py-3">
                <p className="text-muted-foreground text-[11px]">Convertis</p>
                <p className="text-xl font-bold text-emerald-400 tabular-nums">
                  {convertedReferrals}
                </p>
              </div>
              <div className="flex flex-col gap-1 px-4 py-3">
                <p className="text-muted-foreground text-[11px]">Taux</p>
                <p
                  className={`text-xl font-bold tabular-nums ${referralConversionRate >= 20 ? "text-emerald-400" : referralConversionRate >= 10 ? "text-yellow-400" : "text-muted-foreground"}`}
                >
                  {referralConversionRate}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content — worker + sidebar */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Worker — left, wider */}
        <div className="flex flex-col gap-2 lg:col-span-3">
          <SectionTitle>Worker</SectionTitle>
          <WorkerCard />
        </div>

        {/* Sidebar — right */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          {/* Services health */}
          <div className="flex flex-col gap-2">
            <SectionTitle>Services</SectionTitle>
            <ServicesHealth />

            {/* Pipeline de traitement (24h) */}
            {totalTranscripts24h > 0 && (
              <div className="nm-raised overflow-hidden rounded-xl">
                <div className="border-b border-white/[0.04] px-4 py-2.5">
                  <p className="text-xs font-medium">
                    Pipeline de traitement — 24h
                  </p>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {/* Text sources */}
                  <div className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-emerald-400">
                          Texte
                        </p>
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-400">
                          {textSourcesTotal} (
                          {Math.round(
                            (textSourcesTotal / totalTranscripts24h) * 100,
                          )}
                          %)
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-col gap-1">
                      {Object.entries(transcriptSourceStats)
                        .filter(([src]) => TEXT_SOURCES.includes(src))
                        .sort(([, a], [, b]) => b.count - a.count)
                        .map(([src, { count }]) => (
                          <div
                            key={src}
                            className="flex items-center justify-between px-2 py-1"
                          >
                            <p className="font-mono text-[11px] text-white/60">
                              {src}
                            </p>
                            <span className="text-muted-foreground text-[11px] tabular-nums">
                              {count}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Audio sources */}
                  <div className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-orange-400">
                          Audio / Whisper
                        </p>
                        <span className="rounded-full bg-orange-500/10 px-2 py-0.5 font-mono text-[10px] text-orange-400">
                          {audioSourcesTotal} (
                          {Math.round(
                            (audioSourcesTotal / totalTranscripts24h) * 100,
                          )}
                          %)
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-col gap-1">
                      {Object.entries(transcriptSourceStats)
                        .filter(([src]) => AUDIO_SOURCES.includes(src))
                        .sort(([, a], [, b]) => b.count - a.count)
                        .map(([src, { count, cost }]) => (
                          <div
                            key={src}
                            className="flex items-center justify-between px-2 py-1"
                          >
                            <p className="font-mono text-[11px] text-white/60">
                              {src}
                            </p>
                            <span className="text-muted-foreground text-[11px] tabular-nums">
                              {count}
                              {cost > 0 && (
                                <span className="ml-2 text-orange-400/70">
                                  ${(cost / 100).toFixed(2)}
                                </span>
                              )}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Cost summary */}
                  {(() => {
                    const totalCost = Object.entries(transcriptSourceStats)
                      .filter(([src]) => AUDIO_SOURCES.includes(src))
                      .reduce((sum, [, { cost }]) => sum + cost, 0);
                    return totalCost > 0 ? (
                      <div className="border-t border-white/[0.04] px-4 py-2.5">
                        <p className="text-[11px] text-orange-400/70">
                          Coût Whisper/Groq : ${(totalCost / 100).toFixed(3)}
                        </p>
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
            )}

            {totalTranscripts24h === 0 && (
              <div className="nm-raised rounded-xl px-4 py-4">
                <p className="text-muted-foreground text-sm">
                  Aucune vidéo traitée ces 24h
                </p>
              </div>
            )}

            {/* Failure reasons (7 days) */}
            {failureReasonEntries.length > 0 && (
              <div className="nm-raised overflow-hidden rounded-xl">
                <div className="border-b border-white/[0.04] px-4 py-2.5">
                  <p className="text-xs font-medium">
                    Raisons d&apos;échec — 7j (
                    {Object.values(failureReasons).reduce(
                      (sum, count) => sum + count,
                      0,
                    )}
                    )
                  </p>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {failureReasonEntries.map(([reason, count]) => {
                    let colorClass = "text-red-400";
                    if (
                      reason === "music_content" ||
                      reason === "likely_music_no_speech"
                    ) {
                      colorClass = "text-muted-foreground";
                    } else if (reason === "(unknown)") {
                      colorClass = "text-yellow-400";
                    }

                    return (
                      <div
                        key={reason}
                        className="flex items-center justify-between px-4 py-2.5"
                      >
                        <p className={`font-mono text-[11px] ${colorClass}`}>
                          {reason}
                        </p>
                        <span className="text-muted-foreground text-[11px] tabular-nums">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Queue */}
          <div className="flex flex-col gap-2">
            <SectionTitle>
              File de traitement{" "}
              {pendingQueue && pendingQueue.length > 0
                ? `(${pendingQueue.length})`
                : ""}
            </SectionTitle>
            <div className="nm-raised max-h-96 overflow-y-auto rounded-xl">
              {!pendingQueue || pendingQueue.length === 0 ? (
                <div className="flex items-center gap-2 px-4 py-4">
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                  <p className="text-muted-foreground text-sm">File vide</p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {pendingQueue.map((v) => (
                    <div
                      key={`${v.video_id}-${v.language}`}
                      className="flex items-center justify-between px-4 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono text-[11px]">
                          {v.video_id}
                        </p>
                        <p className="text-muted-foreground text-[10px]">
                          {v.language} · {v.channel_id.slice(0, 12)}…
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          v.status === "processing"
                            ? "bg-yellow-500/10 text-yellow-400"
                            : "bg-white/[0.06] text-white/40"
                        }`}
                      >
                        {v.status === "processing" ? (
                          <span className="flex items-center gap-1">
                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            processing
                          </span>
                        ) : (
                          "pending"
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Failed videos */}
          <div className="flex flex-col gap-2">
            <SectionTitle>
              Vidéos échouées{" "}
              {recentFailed && recentFailed.length > 0
                ? `(${recentFailed.length})`
                : ""}
            </SectionTitle>
            <div className="nm-raised max-h-96 overflow-y-auto rounded-xl">
              {!recentFailed || recentFailed.length === 0 ? (
                <div className="flex items-center gap-2 px-4 py-4">
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                  <p className="text-muted-foreground text-sm">
                    Aucune vidéo échouée
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {recentFailed.map((v) => (
                    <div
                      key={`${v.video_id}-${v.language}`}
                      className="flex items-center justify-between gap-3 px-4 py-2.5"
                    >
                      <div className="min-w-0">
                        <a
                          href={`https://www.youtube.com/watch?v=${v.video_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-[11px] text-red-400 underline-offset-2 hover:underline"
                        >
                          {v.video_id}
                        </a>
                        <p className="text-muted-foreground mt-0.5 text-[10px]">
                          {v.channel_id} · {v.language} ·{" "}
                          {new Date(v.created_at).toLocaleString("fr-FR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        {v.metadata?.error && (
                          <p className="mt-0.5 font-mono text-[9px] text-red-400/60">
                            {v.metadata.error}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 rounded-full bg-red-500/10 px-2 py-0.5 font-mono text-[10px] text-red-400">
                        ×{v.failure_count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Top chaînes + Langues */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Top chaînes */}
        <div className="flex flex-col gap-2">
          <SectionTitle>Top chaînes</SectionTitle>
          <div className="nm-raised overflow-hidden rounded-xl">
            {topChannels.length === 0 ? (
              <p className="text-muted-foreground px-4 py-4 text-sm">
                Aucune chaîne active
              </p>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {topChannels.map((ch, i) => (
                  <div
                    key={ch.id}
                    className="flex items-center justify-between px-4 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="text-muted-foreground/40 w-4 shrink-0 text-[11px] tabular-nums">
                        {i + 1}
                      </span>
                      <p className="truncate text-sm">{ch.name}</p>
                    </div>
                    <span className="text-muted-foreground ml-2 shrink-0 text-xs tabular-nums">
                      {ch.count} follower{ch.count > 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Langues */}
        <div className="flex flex-col gap-2">
          <SectionTitle>Langues TTS</SectionTitle>
          <div className="nm-raised overflow-hidden rounded-xl">
            {topLanguages.length === 0 ? (
              <p className="text-muted-foreground px-4 py-4 text-sm">
                Aucune donnée
              </p>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {topLanguages.map(([lang, count]) => {
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={lang} className="px-4 py-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium uppercase">{lang}</p>
                        <span className="text-muted-foreground text-xs tabular-nums">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="mt-1.5 h-1 w-full rounded-full bg-white/[0.06]">
                        <div
                          className="h-1 rounded-full bg-red-500/50"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Utilisateurs à risque */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <SectionTitle>Utilisateurs à risque</SectionTitle>
          <span className="text-muted-foreground text-xs">
            Pro · chaîne active · 0 livraison / 7j
          </span>
        </div>
        <div className="nm-raised overflow-hidden rounded-xl">
          {atRiskUsers.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-4">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              <p className="text-muted-foreground text-sm">
                Aucun utilisateur à risque
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {atRiskUsers.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between px-4 py-2.5"
                >
                  <p className="text-sm">{u.email}</p>
                  <span className="nm-raised-sm rounded-full px-2 py-0.5 text-[10px] font-medium text-red-400">
                    à risque
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Churn feedbacks */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <SectionTitle>Cancellation reasons</SectionTitle>
          <span className="text-muted-foreground text-xs">
            {offersAccepted}/{cancellationFeedbacks.length} offer accepted
          </span>
        </div>
        <div className="nm-raised overflow-hidden rounded-xl">
          {cancellationFeedbacks.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-4">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              <p className="text-muted-foreground text-sm">No cancellations</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {cancellationFeedbacks.map((f) => (
                <div key={f.id} className="flex flex-col gap-1 px-4 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{f.reason}</p>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {f.offer_accepted && (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                          offer accepted
                        </span>
                      )}
                      <span className="text-muted-foreground text-[10px] tabular-nums">
                        {new Date(f.created_at).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                  {f.custom_message && (
                    <p className="text-muted-foreground text-xs">
                      {f.custom_message}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
