import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./utils/auth-test";
import {
  completeOnboarding,
  clearSubscriptions,
  deleteTestUser,
} from "./utils/db";

/**
 * Subscription management tests — add and remove YouTube channels.
 * Runs serially to avoid race conditions on the shared test user.
 */
test.describe.configure({ mode: "serial" });

// Skipped: requires authenticated user. Email auth is disabled in Supabase
// (Google OAuth only), so we can't sign in a test user via password from CI.
test.describe.skip("Subscription Management", () => {
  let userId: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const result = await loginAsTestUser({ page });
    userId = result.userId;
    await completeOnboarding(userId);
    await clearSubscriptions(userId);
    await page.close();
  });

  test.afterAll(async () => {
    await clearSubscriptions(userId);
    await deleteTestUser();
  });

  test("can add a YouTube channel via URL", async ({ page }) => {
    await loginAsTestUser({ page });
    await completeOnboarding(userId);
    await clearSubscriptions(userId);

    await page.goto("/dashboard");
    await expect(page).toHaveURL("/dashboard");

    // Click the add channel button
    const addBtn = page.getByRole("button", { name: /add.*(channel|source)/i });
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // Fill in a YouTube channel URL
    const input = page.getByRole("textbox", { name: /url|channel/i });
    await expect(input).toBeVisible();
    await input.fill("https://www.youtube.com/@veritasium");

    // Submit the form
    const submitBtn = page.getByRole("button", { name: /add|confirm|save/i });
    await submitBtn.click();

    // Channel should appear in the dashboard
    await expect(page.getByText(/veritasium/i)).toBeVisible({ timeout: 10000 });
  });

  test("added channel appears in the dashboard list", async ({ page }) => {
    await loginAsTestUser({ page });
    await completeOnboarding(userId);

    await page.goto("/dashboard");
    await expect(page).toHaveURL("/dashboard");

    // The channel added in the previous test should still be visible
    await expect(page.getByText(/veritasium/i)).toBeVisible({ timeout: 10000 });
  });

  test("can remove a YouTube channel", async ({ page }) => {
    await loginAsTestUser({ page });
    await completeOnboarding(userId);

    await page.goto("/dashboard");
    await expect(page).toHaveURL("/dashboard");

    // Wait for the channel to appear
    await expect(page.getByText(/veritasium/i)).toBeVisible({ timeout: 10000 });

    // Look for a remove/delete/unsubscribe button near the channel entry
    // This could be a menu button, trash icon, or direct remove button
    const channelCard = page
      .getByText(/veritasium/i)
      .locator("..")
      .locator("..");
    const removeBtn = channelCard.getByRole("button", {
      name: /remove|delete|unsubscribe/i,
    });

    // If there's a menu button (three dots), click it first
    const menuBtn = channelCard.getByRole("button", {
      name: /more|menu|options/i,
    });
    if (await menuBtn.isVisible().catch(() => false)) {
      await menuBtn.click();
      const removeMenuItem = page.getByRole("menuitem", {
        name: /remove|delete|unsubscribe/i,
      });
      await removeMenuItem.click();
    } else if (await removeBtn.isVisible().catch(() => false)) {
      await removeBtn.click();
    }

    // Confirm removal if a confirmation dialog appears
    const confirmBtn = page.getByRole("button", {
      name: /confirm|yes|remove|delete/i,
    });
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click();
    }

    // Channel should no longer appear
    await expect(page.getByText(/veritasium/i)).toBeHidden({ timeout: 10000 });
  });
});
