/**
 * Supabase admin helpers for e2e test data management.
 * Uses the service role key — never import this in browser/client code.
 */
import { createClient } from "@supabase/supabase-js";

const TEST_EMAIL = "e2e-test@brieftube.local";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for e2e tests",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Reset the test user's profile to a "fresh new user" state */
export async function resetTestUser(userId: string): Promise<void> {
  const admin = getAdmin();
  await admin
    .from("profiles")
    .update({ onboarding_completed: false })
    .eq("id", userId);
}

/** Mark the test user as having completed onboarding */
export async function completeOnboarding(userId: string): Promise<void> {
  const admin = getAdmin();
  await admin
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("id", userId);
}

/** Remove all YouTube channel subscriptions for the test user */
export async function clearSubscriptions(userId: string): Promise<void> {
  const admin = getAdmin();
  await admin.from("subscriptions").delete().eq("user_id", userId);
}

/** Delete the e2e test user entirely (call in afterAll to keep DB clean) */
export async function deleteTestUser(): Promise<void> {
  const admin = getAdmin();
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const user = list.users.find((u) => u.email === TEST_EMAIL);
  if (user) {
    await admin.auth.admin.deleteUser(user.id);
  }
}
