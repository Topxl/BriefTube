"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/mail/send-email";
import { GiftTrialEmail } from "@/components/emails/gift-trial-email";
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

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!env.ADMIN_USER_ID || user?.id !== env.ADMIN_USER_ID) {
    redirect("/dashboard");
  }
}

export async function grantProTrial(
  email: string,
  months: number,
): Promise<{ ok: true; trialEndsAt: string } | { ok: false; error: string }> {
  await requireAdmin();

  if (!email || months < 1 || months > 24) {
    return { ok: false, error: "Paramètres invalides" };
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id, email, trial_ends_at")
    .eq("email", email.toLowerCase().trim())
    .maybeSingle();

  if (!profile) {
    return { ok: false, error: "Utilisateur introuvable" };
  }

  // Extend from current trial end (if in the future) or from now
  const base =
    profile.trial_ends_at && new Date(profile.trial_ends_at) > new Date()
      ? new Date(profile.trial_ends_at)
      : new Date();

  base.setMonth(base.getMonth() + months);
  const trialEndsAt = base.toISOString();

  const { error: updateError } = await admin
    .from("profiles")
    .update({ trial_ends_at: trialEndsAt, max_channels: 999 })
    .eq("id", profile.id);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  const formattedDate = base.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  await sendEmail({
    to: profile.email ?? email, // eslint-disable-line @typescript-eslint/no-unnecessary-condition
    subject: `${months === 1 ? "1 mois" : `${months} mois`} d'accès Pro BriefTube offerts`,
    html: GiftTrialEmail({ months, trialEndsAt: formattedDate }),
  });

  return { ok: true, trialEndsAt: formattedDate };
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
  if (!env.ADMIN_USER_ID || user?.id !== env.ADMIN_USER_ID)
    redirect("/dashboard");

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
