/**
 * Test-only authentication endpoint.
 * Generates a Supabase magic link for the e2e test user.
 * ONLY available in non-production environments.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

const TEST_EMAIL = "e2e-test@brieftube.local";

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production" && !process.env.CI) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const { origin, searchParams } = new URL(request.url);
  const next = searchParams.get("next") ?? "/dashboard";
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const admin = createAdminClient();

  // Find or create the e2e test user
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  let testUser = list.users.find((u) => u.email === TEST_EMAIL);

  if (!testUser) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      email_confirm: true,
    });
    if (error) {
      return NextResponse.json(
        { error: `Failed to create test user: ${error.message}` },
        { status: 500 },
      );
    }
    testUser = created.user;
  }

  // Generate a magic link that redirects back to the app's auth callback
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: TEST_EMAIL,
    options: { redirectTo },
  });

  if (linkError || !link.properties.action_link) {
    return NextResponse.json(
      { error: `Failed to generate magic link: ${linkError?.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    actionLink: link.properties.action_link,
    userId: testUser.id,
    email: TEST_EMAIL,
  });
}
