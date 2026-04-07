/**
 * Test-only authentication endpoint.
 * Creates/finds the e2e test user, sets a known password, signs in via
 * signInWithPassword (which sets the auth cookies on the response), and
 * returns the user ID.
 *
 * ONLY available in non-production environments OR when ENABLE_TEST_AUTH=true.
 */
import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

const TEST_EMAIL = "e2e-test@brieftube.local";
// Test-only password for the throwaway e2e user. Override via env in CI if needed.
const TEST_PASSWORD =
  process.env.E2E_TEST_PASSWORD ?? "e2e-only-not-secret-do-not-reuse";

export async function GET() {
  const enabled =
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_TEST_AUTH === "true";
  if (!enabled) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const admin = createAdminClient();

  // Find or create the e2e test user
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  let testUser = list.users.find((u) => u.email === TEST_EMAIL);

  if (!testUser) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (error) {
      return NextResponse.json(
        { error: `Failed to create test user: ${error.message}` },
        { status: 500 },
      );
    }
    testUser = created.user;
  } else {
    // Ensure the password is up to date (in case it was changed)
    await admin.auth.admin.updateUserById(testUser.id, {
      password: TEST_PASSWORD,
    });
  }

  // Sign in via the route handler client — this sets the auth cookies
  // on the NextResponse via the @supabase/ssr cookie handlers.
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (signInError) {
    return NextResponse.json(
      { error: `Failed to sign in test user: ${signInError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    userId: testUser.id,
    email: TEST_EMAIL,
  });
}
