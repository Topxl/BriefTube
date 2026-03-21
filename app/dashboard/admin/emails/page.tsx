import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { Resend } from "resend";
import { Send, CheckCircle, Eye } from "@/lib/icons";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { DigestTriggerButton } from "@/components/admin/digest-trigger-button";
import { AnnouncementSendButton } from "@/components/admin/announcement-send-button";
import { EMAIL_WORKFLOWS } from "@/lib/email-workflows";
import type { WorkflowDef, ConversionMetric } from "@/lib/email-workflows";

type RawLog = {
  email_type: string;
  sent_at: string;
  opened_at: string | null;
  profiles: {
    email: string | null;
    subscription_status: string | null;
    telegram_connected: boolean | null;
  } | null;
};

type WorkflowData = {
  total: number;
  last30d: number;
  opened: number;
  lastSentAt: string | null;
  sparkline: number[];
  conversionConverted: number;
  conversionTotal: number;
  eligibleNow: number;
};

type EligibleCounts = {
  trial_j3: number;
  trial_j1: number;
  trial_expired: number;
  activation: number;
  reengagement: number;
  digest_subscribers: number;
  first_summary: number;
  onboarding_j1: number;
  onboarding_j3: number;
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-muted-foreground/50 px-1 text-xs font-medium tracking-wide uppercase">
      {children}
    </h2>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function buildSparkline(dayMap: Record<string, number>): number[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (13 - i));
    return dayMap[d.toISOString().slice(0, 10)] ?? 0;
  });
}

function isConverted(log: RawLog, metric: ConversionMetric): boolean {
  if (!metric || !log.profiles) return false;
  if (metric.field === "subscription_status") {
    const m = metric as Extract<
      ConversionMetric,
      { field: "subscription_status" }
    >;
    return log.profiles.subscription_status === m.value;
  }
  const m = metric as Extract<
    ConversionMetric,
    { field: "telegram_connected" }
  >;
  return log.profiles.telegram_connected === m.value;
}

function TriggerBadge({ type }: { type: WorkflowDef["trigger"]["type"] }) {
  const styles = {
    inngest: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    cron: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    manual: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  };
  const labels = { inngest: "Inngest", cron: "Cron", manual: "Manual" };
  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${styles[type]}`}
    >
      {labels[type]}
    </span>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex h-5 items-end gap-px">
      {data.map((v, i) => (
        <div
          key={i}
          className={`flex-1 rounded-[1px] transition-all ${v > 0 ? "bg-white/30" : "bg-white/[0.05]"}`}
          style={{ height: `${v > 0 ? Math.max((v / max) * 100, 12) : 6}%` }}
        />
      ))}
    </div>
  );
}

function MiniRate({
  label,
  value,
  sub,
  color = "bg-emerald-400",
}: {
  label: string;
  value: number | null;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-muted-foreground/40 text-[10px] font-medium tracking-wide uppercase">
        {label}
      </p>
      <p
        className={`text-sm font-bold tabular-nums ${value !== null && value > 0 ? "text-foreground" : "text-muted-foreground/30"}`}
      >
        {value === null ? "—" : `${value}%`}
      </p>
      {value !== null && (
        <div className="h-0.5 w-full rounded-full bg-white/[0.06]">
          <div
            className={`h-full rounded-full ${color}`}
            style={{ width: `${Math.min(value, 100)}%` }}
          />
        </div>
      )}
      {sub && <p className="text-muted-foreground/40 text-[10px]">{sub}</p>}
    </div>
  );
}

function WorkflowCard({
  workflow,
  data,
  isDigest = false,
}: {
  workflow: WorkflowDef;
  data: WorkflowData;
  isDigest?: boolean;
}) {
  const Icon = workflow.icon;
  const isActive = data.last30d > 0;
  const openRate =
    data.total > 0 ? Math.round((data.opened / data.total) * 100) : null;
  const convRate =
    workflow.conversionMetric && data.conversionTotal > 0
      ? Math.round((data.conversionConverted / data.conversionTotal) * 100)
      : null;

  return (
    <div className="nm-raised flex flex-col gap-4 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <div className="nm-inset-sm mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
            <Icon className="text-muted-foreground h-3.5 w-3.5" />
          </div>
          <div>
            <p className="text-sm leading-tight font-semibold">
              {workflow.name}
            </p>
            <p className="text-muted-foreground mt-0.5 text-[11px] leading-snug">
              {workflow.description}
            </p>
          </div>
        </div>
        <div
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${isActive ? "bg-emerald-400" : "bg-white/10"}`}
          title={isActive ? "Active — sent in last 30d" : "No recent sends"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <TriggerBadge type={workflow.trigger.type} />
        <span className="text-muted-foreground text-[11px]">
          {workflow.trigger.label}
        </span>
        {workflow.trigger.schedule && (
          <code className="text-muted-foreground/50 text-[10px]">
            {workflow.trigger.schedule}
          </code>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <MiniRate label="Open rate" value={openRate} color="bg-blue-400" />
        <MiniRate
          label={workflow.conversionMetric ? `Converted` : "Conversion"}
          value={convRate}
          sub={workflow.conversionMetric?.label}
          color="bg-emerald-400"
        />
        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground/40 text-[10px] font-medium tracking-wide uppercase">
            Eligible now
          </p>
          <p
            className={`text-sm font-bold tabular-nums ${data.eligibleNow > 0 ? "text-yellow-400" : "text-muted-foreground/30"}`}
          >
            {data.eligibleNow}
          </p>
          <p className="text-muted-foreground/40 text-[10px]">users</p>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground/40 text-[10px] font-medium tracking-wide uppercase">
          Last 14 days
        </p>
        <Sparkline data={data.sparkline} />
      </div>

      <div className="flex flex-col gap-0.5">
        {workflow.conditions.map((c, i) => (
          <p
            key={i}
            className="text-muted-foreground flex items-start gap-1.5 text-[11px]"
          >
            <span className="mt-[3px] shrink-0 text-[7px] opacity-40">▸</span>
            {c}
          </p>
        ))}
      </div>

      <div className="flex items-center gap-4 border-t border-white/[0.04] pt-3">
        <div>
          <p className="text-muted-foreground/50 text-[10px]">30d</p>
          <p
            className={`text-sm font-bold tabular-nums ${data.last30d > 0 ? "text-emerald-400" : "text-muted-foreground/30"}`}
          >
            {data.last30d}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground/50 text-[10px]">Total</p>
          <p className="text-sm font-bold tabular-nums">{data.total}</p>
        </div>
        {data.lastSentAt && (
          <div>
            <p className="text-muted-foreground/50 text-[10px]">Last</p>
            <p className="text-muted-foreground text-[11px] tabular-nums">
              {timeAgo(data.lastSentAt)}
            </p>
          </div>
        )}
        {isDigest && (
          <div className="ml-auto">
            <DigestTriggerButton />
          </div>
        )}
        <a
          href={`/api/admin/email-preview/${workflow.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`${isDigest ? "" : "ml-auto"} text-muted-foreground/40 hover:text-muted-foreground rounded p-1 transition-colors`}
          title="Preview email"
        >
          <Eye className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

export default async function AdminEmailsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!env.ADMIN_USER_ID || user?.id !== env.ADMIN_USER_ID) {
    redirect("/dashboard");
  }

  const now = Date.now();
  const h = 3_600_000;
  const thirtyDaysAgo = new Date(now - 30 * 24 * 3600_000);

  const admin = createAdminClient();

  const logsResult = await admin
    .from("email_logs")
    .select(
      "email_type, sent_at, opened_at, profiles(email, subscription_status, telegram_connected)",
    )
    .order("sent_at", { ascending: false });
  const rawLogs = (logsResult.data || []) as RawLog[];

  const [
    { count: cTrialJ3 },
    { count: cTrialJ1 },
    { count: cTrialExp },
    { count: cActivation },
    { count: cDigest },
    { count: cOJ1 },
    { count: cOJ3 },
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("subscription_status", "free")
      .gte("trial_ends_at", new Date(now + 60 * h).toISOString())
      .lte("trial_ends_at", new Date(now + 84 * h).toISOString()),
    admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("subscription_status", "free")
      .gte("trial_ends_at", new Date(now + 12 * h).toISOString())
      .lte("trial_ends_at", new Date(now + 36 * h).toISOString()),
    admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("subscription_status", "free")
      .gte("trial_ends_at", new Date(now - 36 * h).toISOString())
      .lte("trial_ends_at", new Date(now - 12 * h).toISOString()),
    admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("telegram_connected", false)
      .gte("created_at", new Date(now - 36 * h).toISOString())
      .lte("created_at", new Date(now - 12 * h).toISOString()),
    admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("newsletter_enabled", true),
    // Onboarding J+1 — created 24-48h ago
    admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", new Date(now - 48 * h).toISOString())
      .lte("created_at", new Date(now - 24 * h).toISOString()),
    // Onboarding J+3 — created 72-96h ago
    admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", new Date(now - 96 * h).toISOString())
      .lte("created_at", new Date(now - 72 * h).toISOString()),
  ]);

  const eligible: EligibleCounts = {
    trial_j3: cTrialJ3 || 0,
    trial_j1: cTrialJ1 || 0,
    trial_expired: cTrialExp || 0,
    activation: cActivation || 0,
    reengagement: 0,
    digest_subscribers: cDigest || 0,
    first_summary: 0,
    onboarding_j1: cOJ1 || 0,
    onboarding_j3: cOJ3 || 0,
  };

  type WMap = Record<
    string,
    {
      total: number;
      last30d: number;
      opened: number;
      lastSentAt: string | null;
      dayMap: Record<string, number>;
      conversionConverted: number;
      conversionTotal: number;
    }
  >;

  const wmap: WMap = {};
  const conversionByType: Record<string, ConversionMetric> = {};
  for (const wf of EMAIL_WORKFLOWS) {
    conversionByType[wf.id] = wf.conversionMetric;
  }

  for (const log of rawLogs) {
    const type = log.email_type;

    if (!(type in wmap)) {
      wmap[type] = {
        total: 0,
        last30d: 0,
        opened: 0,
        lastSentAt: null,
        dayMap: {},
        conversionConverted: 0,
        conversionTotal: 0,
      };
    }
    const entry = wmap[type];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (entry !== undefined) {
      entry.total++;
      if (new Date(log.sent_at) >= thirtyDaysAgo) entry.last30d++;
      if (log.opened_at) entry.opened++;
      if (!entry.lastSentAt || log.sent_at > entry.lastSentAt)
        entry.lastSentAt = log.sent_at;

      const dayKey = log.sent_at.slice(0, 10);
      entry.dayMap[dayKey] = (entry.dayMap[dayKey] || 0) + 1;

      const metric = conversionByType[type];
      if (metric) {
        entry.conversionTotal++;
        if (isConverted(log, metric)) entry.conversionConverted++;
      }
    }
  }

  function toWorkflowData(id: string, eligibleId: string | null): WorkflowData {
    const e = wmap[id] ?? {
      total: 0,
      last30d: 0,
      opened: 0,
      lastSentAt: null,
      dayMap: {},
      conversionConverted: 0,
      conversionTotal: 0,
    };
    return {
      total: e.total,
      last30d: e.last30d,
      opened: e.opened,
      lastSentAt: e.lastSentAt,
      sparkline: buildSparkline(e.dayMap),
      conversionConverted: e.conversionConverted,
      conversionTotal: e.conversionTotal,

      eligibleNow: eligibleId
        ? eligible[eligibleId as keyof EligibleCounts] || 0
        : 0,
    };
  }

  const totalSent30d = Object.values(wmap).reduce((s, e) => s + e.last30d, 0);
  const totalOpened = Object.values(wmap).reduce((s, e) => s + e.opened, 0);
  const totalSent = Object.values(wmap).reduce((s, e) => s + e.total, 0);
  const avgOpenRate =
    totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;

  type ResendEmail = {
    id: string;
    to: string[];
    subject: string;
    created_at: string;
    last_event?: string;
  };
  let resendEmails: ResendEmail[] = [];
  try {
    if (env.RESEND_API_KEY) {
      const resend = new Resend(env.RESEND_API_KEY);
      const result = await resend.emails.list({ limit: 100 });
      if (result.data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resendEmails = ((result.data as any).data ?? []) as ResendEmail[];
      }
    }
  } catch {
    // Resend not available
  }

  const deliveredCount = resendEmails.filter(
    (e) => (e.last_event ?? "delivered") === "delivered",
  ).length;
  const deliveryRate =
    resendEmails.length > 0
      ? Math.round((deliveredCount / resendEmails.length) * 100)
      : null;

  return (
    <div className="flex flex-col gap-8">
      <AdminBreadcrumb />

      <div>
        <h1 className="text-lg font-semibold">Emails</h1>
        <p className="text-muted-foreground text-xs">
          {EMAIL_WORKFLOWS.length} automations · {totalSent30d} sent in 30d ·{" "}
          {avgOpenRate}% avg open rate
          {deliveryRate !== null && ` · ${deliveryRate}% Resend delivery`}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <SectionTitle>Broadcasts</SectionTitle>
        <div className="nm-raised flex flex-col gap-3 rounded-xl p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm leading-tight font-semibold">
                Platform delivery announcement
              </p>
              <p className="text-muted-foreground mt-0.5 text-[11px] leading-snug">
                Discord, Slack & RSS — 61 users opted in
              </p>
            </div>
          </div>
          <AnnouncementSendButton />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <SectionTitle>Automations</SectionTitle>
          <span className="text-muted-foreground text-[11px]">
            {eligible.digest_subscribers} digest subscribers
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {EMAIL_WORKFLOWS.map((workflow) => (
            <WorkflowCard
              key={workflow.id}
              workflow={workflow}
              data={toWorkflowData(workflow.id, workflow.eligibleId)}
              isDigest={workflow.id === "daily_digest"}
            />
          ))}
        </div>
      </div>

      {resendEmails.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <SectionTitle>Recent sends</SectionTitle>
            <div className="flex items-center gap-2">
              {deliveryRate !== null && (
                <span
                  className={`text-xs font-medium ${deliveryRate >= 95 ? "text-emerald-400" : deliveryRate >= 80 ? "text-yellow-400" : "text-red-400"}`}
                >
                  <CheckCircle className="mr-1 inline h-3 w-3" />
                  {deliveryRate}% delivered
                </span>
              )}
              <span className="text-muted-foreground text-[11px]">
                {resendEmails.length} emails
              </span>
            </div>
          </div>
          <div className="nm-raised overflow-hidden rounded-xl">
            <div className="flex items-center border-b border-white/[0.04] px-4 py-2">
              <p className="text-muted-foreground flex-1 text-xs font-medium">
                Recipient
              </p>
              <p className="text-muted-foreground hidden w-52 text-right text-[10px] sm:block">
                Subject
              </p>
              <p className="text-muted-foreground w-16 text-right text-[10px]">
                Sent
              </p>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {resendEmails.slice(0, 20).map((email) => {
                const to = Array.isArray(email.to) ? email.to[0] : email.to;
                const isDev = email.subject.startsWith("[DEV]");
                const isTest = email.subject.startsWith("[TEST]");
                return (
                  <div
                    key={email.id}
                    className="flex items-center gap-2 px-4 py-2.5"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                      <p className="truncate text-sm">{to}</p>
                      {(isDev || isTest) && (
                        <span className="text-muted-foreground/40 shrink-0 text-[9px] font-medium uppercase">
                          {isDev ? "dev" : "test"}
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground hidden w-52 truncate text-right text-[11px] sm:block">
                      {email.subject
                        .replace(/^\[DEV\]\s*/, "")
                        .replace(/^\[TEST\]\s*/, "")}
                    </p>
                    <span className="text-muted-foreground w-16 text-right text-[11px] tabular-nums">
                      {timeAgo(email.created_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {resendEmails.length === 0 && (
        <div className="nm-raised flex items-center gap-2 rounded-xl px-4 py-3">
          <Send className="text-muted-foreground/30 h-4 w-4" />
          <p className="text-muted-foreground text-sm">
            Resend history not available
          </p>
        </div>
      )}
    </div>
  );
}
