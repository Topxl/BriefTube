import type { Page } from "@playwright/test";

type TestAuthResponse = {
  userId: string;
  email: string;
};

type LoginOptions = {
  page: Page;
  /** Route to land on after auth (default: /dashboard) */
  next?: string;
};

/**
 * Authenticates as the e2e test user.
 * Calls /api/test/auth which signs in via signInWithPassword and sets the
 * auth cookies on the response. Then navigates to the target page.
 */
export async function loginAsTestUser({
  page,
  next = "/dashboard",
}: LoginOptions): Promise<{ userId: string }> {
  const res = await page.request.get("/api/test/auth");

  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`Test auth endpoint failed (${res.status()}): ${body}`);
  }

  const { userId } = (await res.json()) as TestAuthResponse;

  // Cookies are now set on the page context — navigate to the target route.
  await page.goto(next);
  await page.waitForURL(/(\/dashboard|\/onboarding)/, { timeout: 20000 });

  return { userId };
}
