import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
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
} from "@/lib/icons";
import { NewsletterSeedButton } from "@/components/admin/newsletter-seed-button";
import { TrialRemindersButton } from "@/components/admin/trial-reminders-button";

const ADMIN_USER_ID = "67320a39-948c-44d2-98e3-c0de49af1ec6";

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
  language: string;
  created_at: string;
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

// ---------------------------------------------------------------
// Page
// ---------------------------------------------------------------

export default async function AdminPage() {
  // Auth guard — use user client to verify session
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id !== ADMIN_USER_ID) {
    redirect("/dashboard");
  }

  // All data queries use admin client to bypass RLS
  const admin = createAdminClient();

  // Compute date without Date.now() (impure in RSC linting context)
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  const since24h = oneDayAgo.toISOString();

  const [
    { count: totalUsers },
    { count: telegramConnected },
    { count: proUsers },
    { count: activeSubscriptions },
    { data: videosToday },
    { data: deliveriesToday },
    { count: totalCompleted },
  ] = await Promise.all([
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
    admin.from("processed_videos").select("status").gte("created_at", since24h),
    admin.from("deliveries").select("status").gte("created_at", since24h),
    admin
      .from("processed_videos")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed"),
  ]);

  // Queries with columns not in generated types — cast explicitly
  const { data: pendingQueueRaw } = await admin
    .from("processed_videos")
    .select("video_id, channel_id, language, created_at, status")
    .in("status", ["pending", "processing"])
    .order("created_at", { ascending: true });
  const pendingQueue = pendingQueueRaw as unknown as PendingVideo[] | null;

  const { data: recentFailedRaw } = await admin
    .from("processed_videos")
    .select("video_id, language, created_at")
    .eq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(5);
  const recentFailed = recentFailedRaw as unknown as FailedVideo[] | null;

  // ── Funnel de conversion ──────────────────────────────────────
  const now = new Date().toISOString();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const [
    { count: trialActive },
    { count: trialExpired },
    { count: freeNoTrial },
    { count: churned },
    { data: expiringTrialsRaw },
  ] = await Promise.all([
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
      .lt("trial_ends_at", sevenDaysFromNow.toISOString())
      .order("trial_ends_at", { ascending: true })
      .limit(10),
  ]);
  const expiringTrials = (expiringTrialsRaw ?? []) as ExpiringTrial[];

  // ── Utilisateurs à risque ─────────────────────────────────────
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: activeSubs } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("active", true);
  const activeSubUserIds = [
    ...new Set((activeSubs ?? []).map((s) => s.user_id)),
  ];

  let atRiskUsers: AtRiskUser[] = [];
  if (activeSubUserIds.length > 0) {
    const [{ data: telegramCandidates }, { data: recentSent }] =
      await Promise.all([
        admin
          .from("profiles")
          .select("id, email")
          .eq("telegram_connected", true)
          .in("id", activeSubUserIds),
        admin
          .from("deliveries")
          .select("user_id")
          .eq("status", "sent")
          .gte("created_at", sevenDaysAgo.toISOString())
          .in("user_id", activeSubUserIds),
      ]);
    const recentIds = new Set((recentSent ?? []).map((d) => d.user_id));
    atRiskUsers = ((telegramCandidates ?? []) as AtRiskUser[]).filter(
      (u) => !recentIds.has(u.id),
    );
  }

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

  const videosCompleted24h = videosByStatus.completed ?? 0;
  const videosFailed24h = videosByStatus.failed ?? 0;
  const videosSkipped24h = videosByStatus.skipped ?? 0;
  const deliveriesSent24h = deliveriesByStatus.sent ?? 0;
  const deliveriesFailed24h = deliveriesByStatus.failed ?? 0;
  const deliveriesPending = deliveriesByStatus.pending ?? 0;

  const total = totalUsers ?? 0;
  const connected = telegramConnected ?? 0;
  const telegramPct = total > 0 ? Math.round((connected / total) * 100) : 0;

  const proCount = proUsers ?? 0;
  const trialExpiredCount = trialExpired ?? 0;
  const trialsStarted = proCount + trialExpiredCount;
  const conversionRate =
    trialsStarted > 0 ? Math.round((proCount / trialsStarted) * 100) : 0;

  // ── MRR ──────────────────────────────────────────────────────
  let monthlyPriceCents = 0;
  try {
    const stripe = getStripe();
    const price = await stripe.prices.retrieve(env.STRIPE_PRO_PRICE_ID);
    monthlyPriceCents = price.unit_amount ?? 0;
  } catch {
    // Stripe not configured
  }
  const mrr = Math.round((proCount * monthlyPriceCents) / 100);

  // ── Utilisateurs actifs 7j ────────────────────────────────────
  const { data: activeDeliveries } = await admin
    .from("deliveries")
    .select("user_id")
    .eq("status", "sent")
    .gte("created_at", sevenDaysAgo.toISOString());
  const activeUsersCount = new Set(
    (activeDeliveries ?? []).map((d) => d.user_id),
  ).size;

  // ── Nouveaux inscrits 14j ─────────────────────────────────────
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const { data: recentSignups } = await admin
    .from("profiles")
    .select("created_at")
    .gte("created_at", fourteenDaysAgo.toISOString())
    .order("created_at", { ascending: true });

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

  // ── Parrainage ────────────────────────────────────────────────
  const { count: totalReferrals } = await admin
    .from("referrals")
    .select("*", { count: "exact", head: true });

  const { data: referralData } = await admin
    .from("referrals")
    .select("referee_id");
  const refereeIds = [
    ...new Set((referralData ?? []).map((r) => r.referee_id)),
  ];

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

  // ── Distribution langues ──────────────────────────────────────
  const { data: langData } = await admin
    .from("profiles")
    .select("preferred_language");
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

  // ── Top chaînes ───────────────────────────────────────────────
  const { data: allActiveSubs } = await admin
    .from("subscriptions")
    .select("channel_id, channel_name")
    .eq("active", true);
  const channelMap = (allActiveSubs ?? []).reduce<
    Record<string, { name: string; count: number }>
  >((acc, s) => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!acc[s.channel_id]) {
      acc[s.channel_id] = { name: s.channel_name, count: 0 };
    }
    acc[s.channel_id].count++;
    return acc;
  }, {});
  const topChannels = Object.entries(channelMap)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([id, data]) => ({ id, name: data.name, count: data.count }));

  // ── Churn feedbacks ───────────────────────────────────────────
  const { data: cancellationFeedbacksRaw } = await admin
    .from("cancellation_feedbacks")
    .select("id, reason, custom_message, offer_accepted, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  const cancellationFeedbacks =
    (cancellationFeedbacksRaw as unknown as CancellationFeedbackRow[] | null) ??
    [];
  const offersAccepted = cancellationFeedbacks.filter(
    (f) => f.offer_accepted,
  ).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">BriefTube Admin</h1>
          <p className="text-muted-foreground text-xs">
            Monitoring & pilotage du worker
          </p>
        </div>
        <div className="nm-raised-sm flex items-center gap-1.5 rounded-lg px-3 py-1.5">
          <Activity className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-xs font-medium text-emerald-400">Live</span>
          <span className="text-muted-foreground text-xs">· 10s</span>
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
            label="Telegram connecté"
            value={telegramConnected ?? 0}
            sub={`${telegramPct}% des users`}
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
            }
            variant={telegramPct >= 50 ? "success" : "warning"}
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
            label="Livraisons échouées"
            value={deliveriesFailed24h}
            sub={`${deliveriesPending} en attente`}
            icon={<MessageCircle className="h-4 w-4" />}
            variant={deliveriesFailed24h > 0 ? "danger" : "default"}
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
          {/* Queue */}
          <div className="flex flex-col gap-2">
            <SectionTitle>File de traitement</SectionTitle>
            <div className="nm-raised rounded-xl">
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

          {/* Recent failures */}
          <div className="flex flex-col gap-2">
            <SectionTitle>Derniers échecs</SectionTitle>
            <div className="nm-raised rounded-xl">
              {!recentFailed || recentFailed.length === 0 ? (
                <div className="flex items-center gap-2 px-4 py-4">
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                  <p className="text-muted-foreground text-sm">
                    Aucun échec récent
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {recentFailed.map((v) => (
                    <div
                      key={`${v.video_id}-${v.language}`}
                      className="px-4 py-2.5"
                    >
                      <p className="font-mono text-[11px] text-red-400">
                        {v.video_id}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-[10px]">
                        {v.language} ·{" "}
                        {new Date(v.created_at).toLocaleString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
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
            Telegram connecté · chaîne active · 0 livraison / 7j
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

      {/* Newsletter */}
      <div className="flex flex-col gap-2">
        <SectionTitle>Newsletter</SectionTitle>
        <div className="nm-raised flex items-center justify-between rounded-xl px-4 py-3">
          <p className="text-muted-foreground text-sm">
            Sync all existing users to Resend audience
          </p>
          <NewsletterSeedButton />
        </div>
        <div className="nm-raised flex flex-col gap-2 rounded-xl px-4 py-3">
          <p className="text-muted-foreground text-sm">
            Send trial expiry reminders (J-3, J-1, expired)
          </p>
          <TrialRemindersButton />
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
