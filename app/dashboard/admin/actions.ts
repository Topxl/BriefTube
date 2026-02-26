"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { runTrialReminders } from "@/lib/cron/trial-reminders";
import type { TrialRemindersResult } from "@/lib/cron/trial-reminders";
import { runActivationEmails } from "@/lib/cron/activation-emails";
import { runReengagementEmails } from "@/lib/cron/reengagement-emails";
import {
  runReferralTrialEmails,
  type ReferralTrialResult,
} from "@/lib/cron/referral-trial-emails";

type RunResult = { sent: number; skipped: number; errors: number };

const ADMIN_USER_ID = "67320a39-948c-44d2-98e3-c0de49af1ec6";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id !== ADMIN_USER_ID) {
    redirect("/dashboard");
  }
}

export async function triggerTrialReminders(): Promise<TrialRemindersResult> {
  await requireAdmin();
  return runTrialReminders();
}

export async function triggerActivationEmails(): Promise<RunResult> {
  await requireAdmin();
  return runActivationEmails();
}

export async function triggerReengagementEmails(): Promise<RunResult> {
  await requireAdmin();
  return runReengagementEmails();
}

export async function triggerReferralTrialEmails(): Promise<ReferralTrialResult> {
  await requireAdmin();
  return runReferralTrialEmails();
}
