import { checkCronAuth } from "@/lib/cron/auth";
import { runTrialReminders } from "@/lib/cron/trial-reminders";
import { runActivationEmails } from "@/lib/cron/activation-emails";
import { runReengagementEmails } from "@/lib/cron/reengagement-emails";
import { runReferralTrialEmails } from "@/lib/cron/referral-trial-emails";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const maxDuration = 300;

export const GET = async (req: NextRequest) => {
  const unauthorized = checkCronAuth(req);
  if (unauthorized) return unauthorized;

  const [
    trialResult,
    activationResult,
    reengagementResult,
    referralTrialResult,
  ] = await Promise.all([
    runTrialReminders(),
    runActivationEmails(),
    runReengagementEmails(),
    runReferralTrialEmails(),
  ]);

  return NextResponse.json({
    ok: true,
    trialResult,
    activationResult,
    reengagementResult,
    referralTrialResult,
  });
};
