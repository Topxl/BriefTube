"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { runTrialReminders } from "@/lib/cron/trial-reminders";
import type { TrialRemindersResult } from "@/lib/cron/trial-reminders";

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
