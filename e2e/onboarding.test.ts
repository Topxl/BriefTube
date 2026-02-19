import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./utils/auth-test";
import { resetTestUser, completeOnboarding, deleteTestUser } from "./utils/db";

/**
 * Onboarding wizard flow tests.
 * Runs serially to avoid race conditions on the shared test user.
 */
test.describe.configure({ mode: "serial" });

test.describe("Onboarding", () => {
  let userId: string;

  test.afterAll(async () => {
    await deleteTestUser();
  });

  test("new user is redirected to /onboarding after login", async ({
    page,
  }) => {
    const result = await loginAsTestUser({ page, next: "/dashboard" });
    userId = result.userId;

    // Reset to "fresh user" state (onboarding_completed = false)
    await resetTestUser(userId);

    // Navigate to dashboard — should redirect to onboarding
    await page.goto("/dashboard");
    await page.waitForURL("/onboarding");
    await expect(page).toHaveURL("/onboarding");
  });

  test("onboarding step 1 shows channel setup", async ({ page }) => {
    await loginAsTestUser({ page, next: "/onboarding" });
    await resetTestUser(userId);

    await page.goto("/onboarding");
    await page.waitForURL("/onboarding");

    // Step 1: channel setup — URL input should be visible
    await expect(
      page.getByRole("textbox", { name: /url|channel/i }),
    ).toBeVisible();
  });

  test("onboarding can advance to step 2 (voice selection)", async ({
    page,
  }) => {
    await loginAsTestUser({ page, next: "/onboarding" });
    await resetTestUser(userId);

    await page.goto("/onboarding");
    await page.waitForURL("/onboarding");

    // Click "Next" or "Continue" without adding a channel (skip)
    const nextBtn = page.getByRole("button", { name: /next|continue|skip/i });
    await expect(nextBtn).toBeVisible();
    await nextBtn.click();

    // Step 2: voice selection should appear
    await expect(page.getByText(/voice/i)).toBeVisible();
  });

  test("authenticated user with onboarding done goes to /dashboard", async ({
    page,
  }) => {
    const result = await loginAsTestUser({ page });
    userId = result.userId;
    await completeOnboarding(userId);

    await page.goto("/dashboard");
    await expect(page).toHaveURL("/dashboard");

    // Dashboard key elements
    await expect(
      page.getByRole("heading", { name: /channel|source/i }),
    ).toBeVisible();
  });
});
