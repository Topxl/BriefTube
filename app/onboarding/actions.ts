"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function completeOnboarding() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  // Use admin client to bypass any session/RLS issues on the update
  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("id", user.id);
}
