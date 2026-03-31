import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Video summary page tests — public page, no authentication required.
 * Uses a real completed video from the database to test rendering.
 */

/** Fetch a completed video ID from the database for testing */
async function getCompletedVideoId(): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await admin
    .from("processed_videos")
    .select("video_id")
    .eq("status", "completed")
    .not("summary", "is", null)
    .limit(1)
    .maybeSingle();

  return data?.video_id ?? null;
}

test.describe("Video Summary Page", () => {
  let videoId: string | null;

  test.beforeAll(async () => {
    videoId = await getCompletedVideoId();
  });

  test("video page renders summary content", async ({ page }) => {
    test.skip(!videoId, "No completed video found in database");

    await page.goto(`/videos/${videoId}`);

    // Page should not 404
    await expect(page).not.toHaveURL(/not-found/);

    // Video title should render as an h1
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
    await expect(heading).not.toBeEmpty();
  });

  test("video page shows AI Summary section", async ({ page }) => {
    test.skip(!videoId, "No completed video found in database");

    await page.goto(`/videos/${videoId}`);

    // The "AI Summary" label should be visible
    await expect(page.getByText(/ai summary/i)).toBeVisible();

    // Summary text content should be present (non-empty article content)
    const summaryContent = page.locator("article .whitespace-pre-line");
    await expect(summaryContent).toBeVisible();
    await expect(summaryContent).not.toBeEmpty();
  });

  test("video page shows thumbnail image", async ({ page }) => {
    test.skip(!videoId, "No completed video found in database");

    await page.goto(`/videos/${videoId}`);

    // YouTube thumbnail should be rendered
    const thumbnail = page.locator(`img[src*="${videoId}"]`);
    await expect(thumbnail).toBeVisible();
  });

  test("video page shows channel back link", async ({ page }) => {
    test.skip(!videoId, "No completed video found in database");

    await page.goto(`/videos/${videoId}`);

    // Back link to channel page should exist
    const backLink = page.locator('a[href^="/channels/"]').first();
    await expect(backLink).toBeVisible();
  });

  test("video page shows CTA section", async ({ page }) => {
    test.skip(!videoId, "No completed video found in database");

    await page.goto(`/videos/${videoId}`);

    // CTA "Start Free Trial" button should be visible
    await expect(
      page.getByRole("link", { name: /start free trial/i }),
    ).toBeVisible();
  });

  test("non-existent video returns 404", async ({ page }) => {
    await page.goto("/videos/non_existent_video_id_12345");

    // Should show a not-found page
    await expect(
      page.getByText(/not found|does not exist|404/i).first(),
    ).toBeVisible();
  });
});
