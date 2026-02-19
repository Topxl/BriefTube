import type { Page } from "@playwright/test";

type TestAuthResponse = {
  actionLink: string;
  userId: string;
  email: string;
};

type LoginOptions = {
  page: Page;
  /** Route to land on after auth (default: /dashboard) */
  next?: string;
};

/**
 * Authenticates as the e2e test user via a Supabase magic link.
 * Navigates to the action link, waits for the session to be set,
 * and returns the test user ID.
 */
export async function loginAsTestUser({
  page,
  next = "/dashboard",
}: LoginOptions): Promise<{ userId: string }> {
  const res = await page.request.get(
    `/api/test/auth?next=${encodeURIComponent(next)}`,
  );

  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`Test auth endpoint failed (${res.status()}): ${body}`);
  }

  const { actionLink, userId } = (await res.json()) as TestAuthResponse;

  // Navigate to the Supabase magic link — it redirects back to /auth/callback
  await page.goto(actionLink);

  // Wait until we land on a known authenticated route
  await page.waitForURL(/(\/dashboard|\/onboarding)/, { timeout: 20000 });

  return { userId };
}
