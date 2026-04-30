import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { captureServerEvent } from "@/lib/posthog/server";
import { logger } from "@/lib/logger";

export type OnboardingCompletionSource =
  | "skip_step_2"
  | "skip_step_3"
  | "auto_happy_path";

export async function markOnboardingCompletedById(
  userId: string,
  source: OnboardingCompletionSource,
): Promise<void> {
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", userId)
    .single();

  if (profile?.onboarding_completed) return;

  const { error } = await admin
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("id", userId);

  if (error) {
    logger.error("Failed to mark onboarding completed", {
      userId,
      source,
      error,
    });
    return;
  }

  await captureServerEvent({
    distinctId: userId,
    event: "onboarding_completed",
    properties: { source },
  });
}
