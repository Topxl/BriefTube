"use server";

import { createClient } from "@/lib/supabase/server";
import {
  markOnboardingCompletedById,
  type OnboardingCompletionSource,
} from "@/lib/onboarding/mark-completed";

type SkipSource = Extract<
  OnboardingCompletionSource,
  "skip_step_2" | "skip_step_3"
>;

export async function markOnboardingCompleted(
  source: SkipSource,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await markOnboardingCompletedById(user.id, source);
}
