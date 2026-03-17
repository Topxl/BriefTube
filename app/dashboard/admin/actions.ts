"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { runTrialReminders } from "@/lib/cron/trial-reminders";
import type { TrialRemindersResult } from "@/lib/cron/trial-reminders";
import { runActivationEmails } from "@/lib/cron/activation-emails";
import { runReengagementEmails } from "@/lib/cron/reengagement-emails";
import {
  runReferralTrialEmails,
  type ReferralTrialResult,
} from "@/lib/cron/referral-trial-emails";
import { runOnboardingApologyEmails } from "@/lib/cron/onboarding-apology-emails";
import { runDailyDigestForUser } from "@/lib/cron/daily-digest";

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

export async function triggerOnboardingApologyEmails(): Promise<RunResult> {
  await requireAdmin();
  return runOnboardingApologyEmails();
}

export async function triggerTestDailyDigest(): Promise<{
  sent: boolean;
  skipped: boolean;
  reason?: string;
  count?: number;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.id !== ADMIN_USER_ID) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("preferred_language")
    .eq("id", user.id)
    .single();

  return runDailyDigestForUser(
    user.id,
    user.email ?? "",
    profile?.preferred_language ?? "fr",
  );
}

export async function extendAllTrialsTo30Days(): Promise<{ updated: number }> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, created_at")
    .not("trial_ends_at", "is", null);

  if (error) throw new Error(error.message);

  const toUpdate = profiles.filter((p) => p.created_at !== null);

  await Promise.all(
    toUpdate.map((profile) => {
      const trialEnd = new Date(profile.created_at as string);
      trialEnd.setDate(trialEnd.getDate() + 30);
      return admin
        .from("profiles")
        .update({ trial_ends_at: trialEnd.toISOString() })
        .eq("id", profile.id);
    }),
  );

  return { updated: toUpdate.length };
}
