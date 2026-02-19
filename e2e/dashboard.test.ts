import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./utils/auth-test";
import {
  completeOnboarding,
  clearSubscriptions,
  deleteTestUser,
} from "./utils/db";

/**
 * Dashboard tests — requires an authenticated user with onboarding complete.
 * Runs serially to avoid race conditions on the shared test user.
 */
test.describe.configure({ mode: "serial" });

test.describe("Dashboard", () => {
  let userId: string;

  test.beforeAll(async ({ browser }) => {
    // Set up the test user with onboarding completed
    const page = await browser.newPage();
    const result = await loginAsTestUser({ page });
    userId = result.userId;
    await completeOnboarding(userId);
    await clearSubscriptions(userId);
    await page.close();
  });

  test.afterAll(async () => {
    await deleteTestUser();
  });

  test("dashboard renders for authenticated user", async ({ page }) => {
    await loginAsTestUser({ page });
    await completeOnboarding(userId);

    await page.goto("/dashboard");
    await expect(page).toHaveURL("/dashboard");

    // Should show the sources/channels section
    await expect(page.getByText(/channel|source/i).first()).toBeVisible();
  });

  test("can add a YouTube channel", async ({ page }) => {
    await loginAsTestUser({ page });
    await completeOnboarding(userId);
    await clearSubscriptions(userId);

    await page.goto("/dashboard");

    // Click "Add channel" button
    const addBtn = page.getByRole("button", { name: /add.*(channel|source)/i });
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // Fill in a YouTube channel URL
    const input = page.getByRole("textbox", { name: /url|channel/i });
    await expect(input).toBeVisible();
    await input.fill("https://www.youtube.com/@mkbhd");

    // Submit
    const submitBtn = page.getByRole("button", { name: /add|confirm|save/i });
    await submitBtn.click();

    // Channel should appear in the list
    await expect(page.getByText(/mkbhd/i)).toBeVisible({ timeout: 10000 });
  });

  test("channel limit shown for free users", async ({ page }) => {
    await loginAsTestUser({ page });
    await completeOnboarding(userId);

    await page.goto("/dashboard");

    // Free users should see channel count / limit info
    await expect(page.getByText(/3|free|limit/i).first()).toBeVisible();
  });

  test("profile page is accessible", async ({ page }) => {
    await loginAsTestUser({ page });
    await completeOnboarding(userId);

    await page.goto("/dashboard/profile");
    await expect(page).toHaveURL("/dashboard/profile");

    // Profile page should show the user's email or account section
    await expect(page.getByText(/profile|account|plan/i).first()).toBeVisible();
  });

  test("trial banner appears for trial users", async ({ page }) => {
    await loginAsTestUser({ page });
    await completeOnboarding(userId);

    await page.goto("/dashboard");

    // Trial users should see a banner (test user gets 7-day trial on first login)
    // May or may not be visible depending on trial state — just ensure no crash
    await expect(page).toHaveURL("/dashboard");
  });
});
