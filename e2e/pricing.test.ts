import { test, expect } from "@playwright/test";

/**
 * Pricing page tests — public page, no authentication required.
 * Verifies plan cards render and CTA buttons are present.
 */
test.describe("Pricing Page", () => {
  test("pricing page renders with heading", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page).toHaveURL("/pricing");

    await expect(
      page.getByRole("heading", { name: /choose your plan/i }),
    ).toBeVisible();
  });

  test("free plan card is displayed", async ({ page }) => {
    await page.goto("/pricing");

    // Free plan should show its features
    await expect(page.getByText(/free/i).first()).toBeVisible();
    await expect(page.getByText(/youtube channels/i).first()).toBeVisible();
  });

  test("plus plan card is displayed", async ({ page }) => {
    await page.goto("/pricing");

    // Plus plan should be visible
    await expect(page.getByText(/plus/i).first()).toBeVisible();
    await expect(page.getByText(/priority processing/i).first()).toBeVisible();
  });

  test("pro plan card is displayed", async ({ page }) => {
    await page.goto("/pricing");

    // Pro plan features
    await expect(page.getByText(/pro/i).first()).toBeVisible();
    await expect(page.getByText(/unlimited channels/i)).toBeVisible();
  });

  test("CTA buttons are present", async ({ page }) => {
    await page.goto("/pricing");

    // There should be CTA buttons for the plans (Get Started, Upgrade, etc.)
    const ctaButtons = page.getByRole("link", {
      name: /get started|start free|upgrade|subscribe|sign up/i,
    });
    await expect(ctaButtons.first()).toBeVisible();
  });

  test("billing interval toggle exists", async ({ page }) => {
    await page.goto("/pricing");

    // Monthly/yearly toggle should be present
    const monthlyOption = page.getByText(/monthly/i);
    const yearlyOption = page.getByText(/year/i);

    await expect(monthlyOption.first()).toBeVisible();
    await expect(yearlyOption.first()).toBeVisible();
  });

  test("pricing FAQ sections render", async ({ page }) => {
    await page.goto("/pricing");

    // Check that the FAQ/explainer sections are visible
    await expect(
      page.getByText(/what does the free plan include/i),
    ).toBeVisible();
    await expect(page.getByText(/what happens if i cancel/i)).toBeVisible();
  });
});
