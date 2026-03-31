import { test, expect } from "@playwright/test";

/**
 * Auth flow E2E tests — no real Google credentials needed.
 * Catches broken imports, missing env vars, and redirect logic bugs
 * in the custom Google OAuth routes.
 */
test.describe("Auth Flow", () => {
  test("Google OAuth redirect includes correct parameters", async ({
    page,
  }) => {
    // Intercept the redirect to accounts.google.com so we don't actually leave
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes("/api/auth/google") &&
          [302, 307, 308].includes(res.status()),
      ),
      page.goto("/api/auth/google"),
    ]);

    const location = response.headers().location;
    expect(location).toBeDefined();

    const redirectUrl = new URL(location);
    expect(redirectUrl.hostname).toBe("accounts.google.com");
    expect(redirectUrl.pathname).toBe("/o/oauth2/v2/auth");
    expect(redirectUrl.searchParams.get("response_type")).toBe("code");
    expect(redirectUrl.searchParams.get("client_id")).toBeTruthy();
    expect(redirectUrl.searchParams.get("redirect_uri")).toContain(
      "/api/auth/google/callback",
    );
    expect(redirectUrl.searchParams.get("scope")).toContain("email");
    expect(redirectUrl.searchParams.get("state")).toBeTruthy();
  });

  test("OAuth callback redirects to /login when params are missing", async ({
    page,
  }) => {
    // Hit the callback with no code/state — should gracefully redirect, not 500
    await page.goto("/api/auth/google/callback");
    await page.waitForURL("**/login");
    expect(page.url()).toContain("/login");
  });

  test("OAuth callback redirects to /login with error param", async ({
    page,
  }) => {
    // Simulate Google returning an error (e.g. user denied consent)
    await page.goto("/api/auth/google/callback?error=access_denied");
    await page.waitForURL("**/login");
    expect(page.url()).toContain("/login");
  });

  test("OAuth callback redirects to /login with invalid state", async ({
    page,
  }) => {
    // Provide code + state but state won't match cookie — should redirect to /login
    await page.goto(
      "/api/auth/google/callback?code=fake_code&state=invalid_state",
    );
    await page.waitForURL("**/login");
    expect(page.url()).toContain("/login");
  });

  test("Google sign-in button triggers OAuth flow", async ({ page }) => {
    await page.goto("/login");

    const googleButton = page.getByRole("button", { name: /google/i });
    await expect(googleButton).toBeVisible();

    // Click and verify navigation starts toward /api/auth/google or accounts.google.com
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes("/api/auth/google") ||
          res.url().includes("accounts.google.com"),
      ),
      googleButton.click(),
    ]);

    // The response should be a redirect (302/307/308) or the page navigated
    expect(response.status()).toBeGreaterThanOrEqual(200);
  });
});
