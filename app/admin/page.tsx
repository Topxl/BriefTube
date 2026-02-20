import { createClient } from "@/lib/supabase/server";
import { WorkerCard } from "@/components/admin/worker-card";
import {
  Users,
  MessageCircle,
  Zap,
  CheckCircle,
  XCircleIcon,
  Send,
  Loader2,
  Activity,
} from "@/lib/icons";

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
    <div className="flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
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

// ---------------------------------------------------------------
// Page
// ---------------------------------------------------------------

export default async function AdminPage() {
  const supabase = await createClient();

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
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("telegram_connected", true),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("subscription_status", "active"),
    supabase
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("active", true),
    supabase
      .from("processed_videos")
      .select("status")
      .gte("created_at", since24h),
    supabase.from("deliveries").select("status").gte("created_at", since24h),
    supabase
      .from("processed_videos")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed"),
  ]);

  // Queries with columns not in generated types — cast explicitly
  const { data: pendingQueueRaw } = await supabase
    .from("processed_videos")
    .select("video_id, channel_id, language, created_at, status")
    .in("status", ["pending", "processing"])
    .order("created_at", { ascending: true });
  const pendingQueue = pendingQueueRaw as unknown as PendingVideo[] | null;

  const { data: recentFailedRaw } = await supabase
    .from("processed_videos")
    .select("video_id, language, created_at")
    .eq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(5);
  const recentFailed = recentFailedRaw as unknown as FailedVideo[] | null;

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
        <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] px-3 py-1.5">
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
            <div className="rounded-xl border border-white/[0.06]">
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
            <div className="rounded-xl border border-white/[0.06]">
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
    </div>
  );
}
