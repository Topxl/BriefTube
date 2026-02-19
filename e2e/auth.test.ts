import { test, expect } from "@playwright/test";

/**
 * Auth redirect tests — no login required.
 * Verifies that public routes are accessible and protected routes redirect.
 */
test.describe("Authentication", () => {
  test("login page renders with Google button", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /google/i })).toBeVisible();
  });

  test("/dashboard redirects to /login when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.waitForURL("/login");
    await expect(page).toHaveURL("/login");
  });

  test("/onboarding redirects to /login when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/onboarding");
    await page.waitForURL("/login");
    await expect(page).toHaveURL("/login");
  });

  test("/dashboard/profile redirects to /login when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/dashboard/profile");
    await page.waitForURL("/login");
    await expect(page).toHaveURL("/login");
  });

  test("/signup redirects to /login", async ({ page }) => {
    await page.goto("/signup");
    await page.waitForURL("/login");
    await expect(page).toHaveURL("/login");
  });
});
