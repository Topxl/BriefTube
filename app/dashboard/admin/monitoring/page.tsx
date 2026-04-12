import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { WorkerCard } from "@/components/admin/worker-card";
import { WebLogsCard } from "@/components/admin/web-logs-card";
import { env } from "@/lib/env";
import { AlertCircle } from "@/lib/icons";
import { ServicesHealth } from "@/components/admin/services-health";
import {
  getPostHogTotalVisitors,
  getPostHogDailyVisitors,
  type DailyVisitorCount,
} from "@/lib/posthog-server";
import { workerFetch } from "@/lib/worker-fetch";
import { logger } from "@/lib/logger";

// Helpers
function buildDailyArray(data: { created_at?: string | null }[], days: number) {
  const now = new Date();
  const result = Array.from({ length: days }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (days - 1 - i));
    return {
      date: d.toISOString().split("T")[0],
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

function mergeDailyVisitors(visitorData: DailyVisitorCount[], days: number) {
  const now = new Date();
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (days - 1 - i));
    const dateStr = d.toISOString().slice(0, 10);
    const match = visitorData.find((v) => v.date === dateStr);
    return {
      date: dateStr,
      label: d.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
      }),
      count: match?.count ?? 0,
    };
  });
}

// Status indicator component
function StatusBadge({ status }: { status: "good" | "warning" | "critical" }) {
  const colors = {
    good: "bg-emerald-500/20 text-emerald-400",
    warning: "bg-yellow-500/20 text-yellow-400",
    critical: "bg-red-500/20 text-red-400",
  };
  const icons = {
    good: "🟢",
    warning: "🟡",
    critical: "🔴",
  };
  return (
    <span
      className={`rounded-full px-2 py-1 text-xs font-medium ${colors[status]}`}
    >
      {icons[status]} {status}
    </span>
  );
}

// KPI Card component
function KPICard({
  label,
  value,
  unit,
  status,
  action,
}: {
  label: string;
  value: number;
  unit?: string;
  status: "good" | "warning" | "critical";
  action?: string;
}) {
  return (
    <div className="nm-raised flex flex-col gap-2 rounded-xl px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
        <StatusBadge status={status} />
      </div>
      <p className="text-2xl font-bold tabular-nums">
        {value.toLocaleString("fr-FR")}
        {unit && (
          <span className="text-muted-foreground ml-1 text-sm">{unit}</span>
        )}
      </p>
      {action && (
        <p className="text-muted-foreground text-[11px] italic">{action}</p>
      )}
    </div>
  );
}

// Simple bar chart with better tooltips
function SimpleChart({
  title,
  data,
  total,
  color = "bg-red-500/50",
}: {
  title: string;
  data: { date: string; label: string; count: number }[];
  total: number;
  color?: string;
}) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="nm-raised rounded-xl px-4 py-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-muted-foreground text-xs font-medium">{title}</p>
        <span className="text-foreground font-semibold tabular-nums">
          {total.toLocaleString("fr-FR")}
        </span>
      </div>
      <div className="flex items-end gap-0.5" style={{ height: "40px" }}>
        {data.map((d, i) => (
          <div
            key={i}
            className="group relative flex flex-1 flex-col items-center justify-end"
            style={{ height: "40px" }}
          >
            <div
              className={`w-full rounded-sm transition-all ${color} cursor-help group-hover:opacity-80`}
              title={`${d.label}: ${d.count}`}
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
      <div className="mt-2 flex justify-between">
        <span className="text-muted-foreground text-[9px]">
          {data[0]?.label}
        </span>
        <span className="text-muted-foreground text-[9px]">
          {data[data.length - 1]?.label}
        </span>
      </div>
    </div>
  );
}

export default async function AdminPage() {
  // Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!env.ADMIN_USER_ID || user?.id !== env.ADMIN_USER_ID) {
    redirect("/dashboard");
  }

  const admin = createAdminClient();

  // Date helpers
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  const since24h = oneDayAgo.toISOString();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

  // Fetch worker data server-side (runs in main Node.js process with localhost access)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fetchWorkerData = async (path: string): Promise<any | null> => {
    try {
      const raw = await workerFetch(path);
      return JSON.parse(raw);
    } catch (e) {
      logger.error(`[monitoring] Failed to fetch ${path}`, {
        error: String(e),
      });
      return null;
    }
  };

  // Fetch all data in parallel
  const [
    totalUsersResult,
    proUsersResult,
    activeSubscriptionsResult,
    videosResult,
    recentFailedResult,
    pendingQueueResult,
    visitorsTotal30d,
    visitorDailyRaw,
    signupsResult,
    workerData,
    servicesData,
    webLogsData,
  ] = await Promise.all([
    admin.from("profiles").select("*", { count: "exact", head: true }),
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
    admin
      .from("processed_videos")
      .select("video_id, created_at, failure_count, metadata")
      .eq("status", "failed")
      .gte("created_at", sevenDaysAgoStr)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("processed_videos")
      .select("*", { count: "exact", head: true })
      .in("status", ["pending", "processing"]),
    getPostHogTotalVisitors(30),
    getPostHogDailyVisitors(30),
    admin
      .from("profiles")
      .select("created_at")
      .gte("created_at", thirtyDaysAgoStr),
    fetchWorkerData("/logs"),
    fetchWorkerData("/services"),
    fetchWorkerData("/web-logs"),
  ]);

  const totalUsers = totalUsersResult.count;
  const proUsers = proUsersResult.count;
  const activeSubscriptions = activeSubscriptionsResult.count;
  const videosToday = videosResult.data;
  const recentFailedRaw = recentFailedResult.data;
  const pendingQueueCount = pendingQueueResult.count;
  const signupsRaw30d = signupsResult.data;

  // Process video data
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

  const pendingQueueCountNum = pendingQueueCount ?? 0;

  // Build failure reasons for critical issues
  type FailedVideoRaw = {
    failure_count: number;
    metadata: { error?: string } | null;
  };

  const failureReasons = (
    (recentFailedRaw as FailedVideoRaw[] | null) ?? []
  ).reduce<Record<string, number>>((acc, v) => {
    const reason = v.metadata?.error ?? "(unknown)";
    acc[reason] = (acc[reason] ?? 0) + 1;
    return acc;
  }, {});

  const topFailureReason = Object.entries(failureReasons).sort(
    ([, a], [, b]) => b - a,
  )[0];

  // Charts data
  const visitorDays30d = mergeDailyVisitors(visitorDailyRaw ?? [], 30);
  const signupDays30d = buildDailyArray(signupsRaw30d ?? [], 30);
  const newSignups30d = signupDays30d.reduce((s, d) => s + d.count, 0);

  // KPI status logic
  function getVideoProcessingStatus(): "good" | "warning" | "critical" {
    if (videosFailed24h === 0) return "good";
    if (videosFailed24h <= 2) return "warning";
    return "critical";
  }

  function getQueueStatus(): "good" | "warning" | "critical" {
    if (pendingQueueCountNum === 0) return "good";
    if (pendingQueueCountNum <= 5) return "warning";
    return "critical";
  }

  function getConversionStatus(): "good" | "warning" | "critical" {
    const total = totalUsers ?? 0;
    const pct = total > 0 ? Math.round(((proUsers ?? 0) / total) * 100) : 0;
    if (pct >= 5) return "good";
    if (pct >= 2) return "warning";
    return "critical";
  }

  // Actions needed
  const actions: {
    severity: "critical" | "warning";
    title: string;
    description: string;
  }[] = [];

  if (videosFailed24h > 5) {
    actions.push({
      severity: "critical",
      title: "Trop de vidéos échouées",
      description: `${videosFailed24h} vidéos ont échoué en 24h. Top raison: "${topFailureReason[0] as string}". Vérifier les logs du worker.`,
    });
  }

  if (pendingQueueCountNum > 10) {
    actions.push({
      severity: "critical",
      title: "File d'attente pleine",
      description: `${pendingQueueCountNum} vidéos en attente. Le worker peut être bloqué ou lent.`,
    });
  }

  if (videosFailed24h === 0 && videosCompleted24h === 0) {
    actions.push({
      severity: "warning",
      title: "Aucun traitement détecté",
      description: "0 vidéo traitée en 24h. Vérifier que le worker tourne.",
    });
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      <AdminBreadcrumb />

      {/* Actions panel */}
      {actions.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <div className="flex gap-2">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
            <div className="flex min-w-0 flex-col gap-2">
              {actions.map((action, i) => (
                <div key={i}>
                  <p className="text-sm font-semibold">{action.title}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs break-words">
                    {action.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Worker Status */}
      <WorkerCard initialData={workerData} />

      {/* Services */}
      <ServicesHealth initialData={servicesData} />

      {/* Web Logs */}
      <WebLogsCard initialData={webLogsData} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <KPICard label="Utilisateurs" value={totalUsers ?? 0} status="good" />
        <KPICard
          label="Abonnés Pro"
          value={proUsers ?? 0}
          status={getConversionStatus()}
          action={
            getConversionStatus() !== "good"
              ? "Améliorer la conversion"
              : undefined
          }
        />
        <KPICard
          label="Abonnements actifs"
          value={activeSubscriptions ?? 0}
          unit="chaînes"
          status="good"
        />
        <KPICard
          label="Visiteurs (30j)"
          value={visitorsTotal30d ?? 0}
          status="good"
        />
      </div>

      {/* Processing Status */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <KPICard
          label="Complétées (24h)"
          value={videosCompleted24h}
          unit="vidéos"
          status="good"
        />
        <KPICard
          label="Échouées (24h)"
          value={videosFailed24h}
          status={getVideoProcessingStatus()}
          action={
            videosFailed24h > 0
              ? `Vérifier: ${topFailureReason[0] as string}`
              : undefined
          }
        />
        <KPICard
          label="En attente"
          value={pendingQueueCountNum}
          unit="vidéos"
          status={getQueueStatus()}
          action={
            getQueueStatus() !== "good" ? "Vérifier le worker" : undefined
          }
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <SimpleChart
          title="Visiteurs / jour (30j)"
          data={visitorDays30d}
          total={visitorsTotal30d ?? 0}
          color="bg-sky-500/50"
        />
        <SimpleChart
          title="Inscrits / jour (30j)"
          data={signupDays30d}
          total={newSignups30d}
          color="bg-emerald-500/50"
        />
      </div>

      {/* Failed videos list */}
      {((recentFailedRaw as FailedVideoRaw[] | null)?.length ?? 0) > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-muted-foreground px-1 text-xs font-medium tracking-wide uppercase">
            Vidéos échouées (7j)
          </h3>
          <div className="nm-raised max-h-64 overflow-y-auto rounded-xl">
            <div className="divide-y divide-white/[0.04]">
              {(recentFailedRaw as FailedVideoRaw[] | null)?.map(
                (v: FailedVideoRaw & { video_id?: string }, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="text-muted-foreground truncate font-mono text-[11px]">
                        {v.video_id}
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
                ),
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
