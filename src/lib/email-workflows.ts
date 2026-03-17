/**
 * Email workflow registry — single source of truth.
 * Update this file when you change triggers/conditions in code.
 * The admin /emails dashboard reads this to render workflow cards.
 */
import type { LucideIcon } from "@/lib/icons";
import { Mail, Clock, Zap, RefreshCw, Users, Star } from "@/lib/icons";

export type WorkflowTrigger = {
  type: "cron" | "inngest" | "manual";
  label: string;
  schedule?: string;
};

export type ConversionMetric =
  | {
      field: "subscription_status";
      value: string;
      label: string;
    }
  | {
      field: "telegram_connected";
      value: boolean;
      label: string;
    }
  | null;

export type EligibleId =
  | "trial_j3"
  | "trial_j1"
  | "trial_expired"
  | "activation"
  | "reengagement"
  | "digest_subscribers"
  | null;

export type WorkflowDef = {
  id: string;
  name: string;
  description: string;
  subject: string;
  trigger: WorkflowTrigger;
  audience: string;
  conditions: string[];
  dedup: "once" | "recurring";
  icon: LucideIcon;
  conversionMetric: ConversionMetric;
  eligibleId: EligibleId;
};

export const EMAIL_WORKFLOWS: WorkflowDef[] = [
  {
    id: "daily_digest",
    name: "Daily Digest",
    description: "Email summary of the day's audio summaries",
    subject: "Your daily summaries — {date}",
    trigger: {
      type: "inngest",
      label: "Inngest cron — every hour",
      schedule: "0 * * * *",
    },
    audience: "All users with digest enabled",
    conditions: [
      "newsletter_enabled = true",
      "newsletter_hour matches current UTC hour",
      "≥1 delivery in last 24h with completed summary",
    ],
    dedup: "recurring",
    icon: Mail,
    conversionMetric: null,
    eligibleId: "digest_subscribers",
  },
  {
    id: "trial_reminder_j3",
    name: "Trial Reminder — J−3",
    description: "Sent 3 days before trial expires",
    subject: "Your BriefTube trial ends in 3 days",
    trigger: { type: "cron", label: "Daily cron" },
    audience: "Free plan users",
    conditions: [
      "subscription_status = free",
      "trial_ends_at within +60h..+84h from now",
      "Once per user",
    ],
    dedup: "once",
    icon: Clock,
    conversionMetric: {
      field: "subscription_status",
      value: "active",
      label: "upgraded",
    },
    eligibleId: "trial_j3",
  },
  {
    id: "trial_reminder_j1",
    name: "Trial Reminder — J−1",
    description: "Sent 1 day before trial expires",
    subject: "Your BriefTube trial ends tomorrow",
    trigger: { type: "cron", label: "Daily cron" },
    audience: "Free plan users",
    conditions: [
      "subscription_status = free",
      "trial_ends_at within +12h..+36h from now",
      "Once per user",
    ],
    dedup: "once",
    icon: Clock,
    conversionMetric: {
      field: "subscription_status",
      value: "active",
      label: "upgraded",
    },
    eligibleId: "trial_j1",
  },
  {
    id: "trial_expired",
    name: "Trial Expired",
    description: "Sent just after trial expires",
    subject: "Your BriefTube trial has ended",
    trigger: { type: "cron", label: "Daily cron" },
    audience: "Free plan users",
    conditions: [
      "subscription_status = free",
      "trial_ends_at within −36h..−12h from now",
      "Once per user",
    ],
    dedup: "once",
    icon: Clock,
    conversionMetric: {
      field: "subscription_status",
      value: "active",
      label: "upgraded",
    },
    eligibleId: "trial_expired",
  },
  {
    id: "activation_telegram",
    name: "Activation — Telegram",
    description: "Personal email to users who haven't connected Telegram",
    subject: "Quick question about your BriefTube account",
    trigger: { type: "cron", label: "Daily cron" },
    audience: "Users ~24h after signup",
    conditions: [
      "telegram_connected = false",
      "created_at within −36h..−12h from now",
      "Once per user",
    ],
    dedup: "once",
    icon: Zap,
    conversionMetric: {
      field: "telegram_connected",
      value: true,
      label: "connected",
    },
    eligibleId: "activation",
  },
  {
    id: "reengagement_7d",
    name: "Re-engagement — 7 days",
    description: "Sent when a Pro user received no summaries in 7 days",
    subject: "Your BriefTube channels have been quiet this week",
    trigger: { type: "cron", label: "Daily cron" },
    audience: "Active Pro users",
    conditions: [
      "subscription_status = active",
      "telegram_connected = true",
      "Has at least one active channel subscription",
      "0 delivered summaries in last 7 days",
      "Once per user",
    ],
    dedup: "once",
    icon: RefreshCw,
    conversionMetric: null,
    eligibleId: "reengagement",
  },
  {
    id: "referral_trial_j3",
    name: "Referral Trial — J−3",
    description: "Sent to referred users 3 days before trial ends",
    subject: "Your BriefTube trial ends in 3 days",
    trigger: { type: "cron", label: "Daily cron" },
    audience: "Referred free plan users",
    conditions: [
      "subscription_status = free",
      "referred_by is not null",
      "trial_ends_at within +60h..+84h from now",
      "Once per user",
    ],
    dedup: "once",
    icon: Users,
    conversionMetric: {
      field: "subscription_status",
      value: "active",
      label: "upgraded",
    },
    eligibleId: null,
  },
  {
    id: "referral_trial_j1",
    name: "Referral Trial — J−1",
    description: "Sent to referred users 1 day before trial ends",
    subject: "Your BriefTube trial ends tomorrow",
    trigger: { type: "cron", label: "Daily cron" },
    audience: "Referred free plan users",
    conditions: [
      "subscription_status = free",
      "referred_by is not null",
      "trial_ends_at within +12h..+36h from now",
      "Once per user",
    ],
    dedup: "once",
    icon: Users,
    conversionMetric: {
      field: "subscription_status",
      value: "active",
      label: "upgraded",
    },
    eligibleId: null,
  },
  {
    id: "early_users_thank_you",
    name: "Early Users — Thank You",
    description: "One-time blast sent to first users at launch",
    subject: "You're one of BriefTube's first users — thank you",
    trigger: { type: "manual", label: "Manual blast" },
    audience: "All users at launch",
    conditions: ["Sent manually once to all existing users"],
    dedup: "once",
    icon: Star,
    conversionMetric: null,
    eligibleId: null,
  },
];
