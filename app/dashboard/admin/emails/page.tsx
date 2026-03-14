import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { Resend } from "resend";
import { Mail, Send, Activity, CheckCircle } from "@/lib/icons";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { NewsletterSeedButton } from "@/components/admin/newsletter-seed-button";
import { TrialRemindersButton } from "@/components/admin/trial-reminders-button";
import { ActivationEmailsButton } from "@/components/admin/activation-emails-button";
import { ReengagementEmailsButton } from "@/components/admin/reengagement-emails-button";
import { ReferralTrialEmailsButton } from "@/components/admin/referral-trial-emails-button";
import { OnboardingApologyButton } from "@/components/admin/onboarding-apology-button";

// ── Types ─────────────────────────────────────────────────────────────────────

type EmailLogRow = { email_type: string | null; created_at: string | null };
type EmailTypeStats = { total: number; last30d: number; lastSentAt: string | null };

const EMAIL_TYPE_LABELS: Record<string, string> = {
  trial_reminder_j3: "Trial reminder J-3",
  trial_reminder_j1: "Trial reminder J-1",
  trial_expired: "Trial expiré",
  activation_telegram: "Activation Telegram",
  reengagement_7d: "Re-engagement 7j",
  referral_trial_j3: "Parrainage J-3",
  referral_trial_j1: "Parrainage J-1",
  onboarding_apology: "Onboarding apology",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-muted-foreground/50 px-1 text-xs font-medium tracking-wide uppercase">
      {children}
    </h2>
  );
}

type StatCardProps = {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger";
};

function StatCard({ label, value, sub, icon, variant = "default" }: StatCardProps) {
  const accent =
    variant === "success" ? "text-emerald-400" :
    variant === "warning" ? "text-yellow-400" :
    variant === "danger" ? "text-red-400" : "text-foreground";
  return (
    <div className="nm-raised flex flex-col gap-3 rounded-xl px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
        <div className="text-muted-foreground/40">{icon}</div>
      </div>
      <div>
        <p className={`text-2xl font-bold tabular-nums ${accent}`}>{value}</p>
        {sub && <p className="text-muted-foreground mt-0.5 text-[11px]">{sub}</p>}
      </div>
    </div>
  );
}


function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}j`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminEmailsPage() {
  // Auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!env.ADMIN_USER_ID || user?.id !== env.ADMIN_USER_ID) {
    redirect("/dashboard");
  }

  const admin = createAdminClient();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // ── Supabase: email_logs ──────────────────────────────────────────────────
  const { data: emailLogsRaw } = await admin
    .from("email_logs")
    .select("email_type, created_at");
  const emailLogs = (emailLogsRaw as unknown as EmailLogRow[] | null) ?? [];
  const totalEmailsSent = emailLogs.length;

  const emailTypeStatsMap: Partial<Record<string, EmailTypeStats>> = {};
  for (const log of emailLogs) {
    const type = log.email_type ?? "unknown";
    const entry = emailTypeStatsMap[type];
    const isRecent = log.created_at
      ? new Date(log.created_at) >= thirtyDaysAgo
      : false;
    if (!entry) {
      emailTypeStatsMap[type] = {
        total: 1,
        last30d: isRecent ? 1 : 0,
        lastSentAt: log.created_at,
      };
    } else {
      entry.total++;
      if (isRecent) entry.last30d++;
      if (log.created_at && (!entry.lastSentAt || log.created_at > entry.lastSentAt)) {
        entry.lastSentAt = log.created_at;
      }
    }
  }
  const emailTypeStats = emailTypeStatsMap as Record<string, EmailTypeStats>;
  const totalEmailsSent30d = Object.values(emailTypeStats).reduce(
    (s, e) => s + e.last30d, 0,
  );

  // ── Resend: recent sent emails ────────────────────────────────────────────
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
    // Resend not available — continue without
  }

  // Group Resend emails by subject (normalized)
  const resendBySubject: Record<string, number> = {};
  for (const e of resendEmails) {
    const key = e.subject.replace(/^\[DEV\]\s*/, "").trim();
    resendBySubject[key] = (resendBySubject[key] ?? 0) + 1;
  }
  const deliveredCount = resendEmails.filter(
    (e) => (e.last_event ?? "delivered") === "delivered",
  ).length;
  const deliveryRate = resendEmails.length > 0
    ? Math.round((deliveredCount / resendEmails.length) * 100)
    : 100;

  return (
    <div className="flex flex-col gap-6">
      <AdminBreadcrumb />

      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold">Emails</h1>
        <p className="text-muted-foreground text-xs">
          Campagnes internes · Historique Resend
        </p>
      </div>

      {/* ── Stats ── */}
      <div className="flex flex-col gap-2">
        <SectionTitle>Vue d&apos;ensemble</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard
            label="Total envoyés"
            value={totalEmailsSent}
            icon={<Mail className="h-4 w-4" />}
            variant={totalEmailsSent > 0 ? "success" : "default"}
          />
          <StatCard
            label="30 derniers jours"
            value={totalEmailsSent30d}
            icon={<Send className="h-4 w-4" />}
            variant={totalEmailsSent30d > 0 ? "success" : "default"}
          />
          <StatCard
            label="Types distincts"
            value={Object.keys(emailTypeStats).length}
            icon={<Activity className="h-4 w-4" />}
          />
          <StatCard
            label="Livraison Resend"
            value={resendEmails.length > 0 ? `${deliveryRate}%` : "—"}
            sub={resendEmails.length > 0 ? `${resendEmails.length} emails` : "Non configuré"}
            icon={<CheckCircle className="h-4 w-4" />}
            variant={deliveryRate >= 95 ? "success" : deliveryRate >= 80 ? "warning" : "danger"}
          />
        </div>
      </div>

      {/* ── Campagnes internes (email_logs) ── */}
      <div className="flex flex-col gap-2">
        <SectionTitle>Campagnes internes</SectionTitle>
        <div className="nm-raised overflow-hidden rounded-xl">
          <div className="flex items-center border-b border-white/[0.04] px-4 py-2">
            <p className="text-muted-foreground flex-1 text-xs font-medium">Campagne</p>
            <p className="text-muted-foreground w-10 text-right text-[10px]">30j</p>
            <p className="text-muted-foreground w-12 text-right text-[10px]">total</p>
          </div>
          {Object.keys(emailTypeStats).length === 0 ? (
            <p className="text-muted-foreground px-4 py-4 text-sm">Aucun email envoyé</p>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {Object.entries(emailTypeStats)
                .sort((a, b) => b[1].total - a[1].total)
                .map(([type, stats]) => (
                  <div key={type} className="flex items-center gap-2 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        {EMAIL_TYPE_LABELS[type] ?? type}
                      </p>
                      {stats.lastSentAt && (
                        <p className="text-muted-foreground text-[11px]">
                          Dernier :{" "}
                          {new Date(stats.lastSentAt).toLocaleDateString("fr-FR", {
                            day: "2-digit", month: "2-digit", year: "2-digit",
                          })}
                        </p>
                      )}
                    </div>
                    <span className={`w-10 text-right text-sm tabular-nums ${stats.last30d > 0 ? "text-emerald-400" : "text-muted-foreground/30"}`}>
                      {stats.last30d}
                    </span>
                    <span className="w-12 text-right text-sm font-medium tabular-nums">
                      {stats.total}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Historique Resend ── */}
      {resendEmails.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <SectionTitle>Historique Resend</SectionTitle>
            <span className="text-muted-foreground text-xs">{resendEmails.length} emails</span>
          </div>

          {/* Par sujet */}
          <div className="nm-raised overflow-hidden rounded-xl">
            <div className="flex items-center border-b border-white/[0.04] px-4 py-2">
              <p className="text-muted-foreground flex-1 text-xs font-medium">Sujet</p>
              <p className="text-muted-foreground w-12 text-right text-[10px]">envoyés</p>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {Object.entries(resendBySubject)
                .sort((a, b) => b[1] - a[1])
                .map(([subject, count]) => (
                  <div key={subject} className="flex items-center gap-2 px-4 py-2.5">
                    <p className="min-w-0 flex-1 truncate text-sm">{subject}</p>
                    <span className="text-foreground w-12 text-right text-sm font-medium tabular-nums">
                      {count}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* 10 derniers emails */}
          <div className="nm-raised overflow-hidden rounded-xl">
            <div className="flex items-center border-b border-white/[0.04] px-4 py-2">
              <p className="text-muted-foreground flex-1 text-xs font-medium">Destinataire</p>
              <p className="text-muted-foreground hidden w-40 text-right text-[10px] sm:block">Sujet</p>
              <p className="text-muted-foreground w-12 text-right text-[10px]">Envoyé</p>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {resendEmails.slice(0, 15).map((email) => {
                const to = Array.isArray(email.to) ? email.to[0] : email.to;
                const isDev = email.subject.startsWith("[DEV]");
                return (
                  <div key={email.id} className="flex items-center gap-2 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{to}</p>
                      {isDev && (
                        <span className="text-muted-foreground text-[10px]">DEV</span>
                      )}
                    </div>
                    <p className="text-muted-foreground hidden w-40 truncate text-right text-[11px] sm:block">
                      {email.subject.replace(/^\[DEV\]\s*/, "")}
                    </p>
                    <span className="text-muted-foreground w-12 text-right text-[11px] tabular-nums">
                      {timeAgo(email.created_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Actions manuelles ── */}
      <div className="flex flex-col gap-2">
        <SectionTitle>Actions manuelles</SectionTitle>
        <div className="nm-raised flex items-center justify-between rounded-xl px-4 py-3">
          <p className="text-muted-foreground text-sm">Sync users → Resend audience</p>
          <NewsletterSeedButton />
        </div>
        <div className="nm-raised flex flex-col gap-2 rounded-xl px-4 py-3">
          <p className="text-muted-foreground text-sm">Trial reminders (J-3, J-1, expiré)</p>
          <TrialRemindersButton />
        </div>
        <div className="nm-raised flex flex-col gap-2 rounded-xl px-4 py-3">
          <p className="text-muted-foreground text-sm">Activation emails (Telegram non connecté +24h)</p>
          <ActivationEmailsButton />
        </div>
        <div className="nm-raised flex flex-col gap-2 rounded-xl px-4 py-3">
          <p className="text-muted-foreground text-sm">Re-engagement (Pro · Telegram · 0 delivery 7j)</p>
          <ReengagementEmailsButton />
        </div>
        <div className="nm-raised flex flex-col gap-2 rounded-xl px-4 py-3">
          <p className="text-muted-foreground text-sm">Referral trial emails (J-3 / J-1)</p>
          <ReferralTrialEmailsButton />
        </div>
        <div className="nm-raised flex flex-col gap-2 rounded-xl border border-yellow-500/20 px-4 py-3">
          <p className="text-muted-foreground text-sm">Onboarding apology (Feb 22–28 · one-time)</p>
          <OnboardingApologyButton />
        </div>
      </div>
    </div>
  );
}
