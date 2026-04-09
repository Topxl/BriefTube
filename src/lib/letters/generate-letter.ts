import { createAdminClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  collectWeekData,
  fetchLatestArcState,
  getWeekWindow,
} from "./data-collector";
import { generateLetterDraft } from "./narrative-generator";
import type { LetterArcState } from "./types";

/**
 * Top-level orchestration: collect week data → generate narrative → insert
 * a new draft row in `weekly_letters`. Returns the inserted row id, or null
 * on failure (e.g. no provider available).
 *
 * Idempotency: if a draft already exists for the same week, returns its id
 * instead of creating a duplicate. Set `force=true` to bypass.
 */
export async function generateAndStoreWeeklyLetter(params: {
  reference?: Date;
  vinNotes?: string | null;
  force?: boolean;
}): Promise<{
  id: string;
  episode_number: number;
  was_existing: boolean;
} | null> {
  const { reference, vinNotes = null, force = false } = params;
  const { weekStart, weekEnd } = getWeekWindow(reference);
  const admin = createAdminClient();
  const weekStartIso = weekStart.toISOString().slice(0, 10);

  // Idempotency + cleanup of dead drafts:
  //   - If a non-dead letter exists for this week (draft/scheduled/sent),
  //     return it as "existing" (unless force=true).
  //   - If a cancelled/skipped letter exists for this week, delete it first
  //     so we can regenerate cleanly with the correct episode number.
  const { data: existing } = await admin
    .from("weekly_letters")
    .select("id, episode_number, status")
    .eq("week_start", weekStartIso)
    .maybeSingle();

  if (existing) {
    const isDead =
      existing.status === "cancelled" || existing.status === "skipped";
    if (!isDead && !force) {
      logger.info("[letters] active letter already exists for this week", {
        week_start: weekStartIso,
        existing_id: existing.id,
        existing_status: existing.status,
      });
      return {
        id: existing.id,
        episode_number: existing.episode_number,
        was_existing: true,
      };
    }
    // Dead or forced: clean it up before regenerating
    logger.info("[letters] removing dead letter before regeneration", {
      week_start: weekStartIso,
      existing_id: existing.id,
      existing_status: existing.status,
      forced: force,
    });
    await admin.from("weekly_letters").delete().eq("id", existing.id);
  }

  // Collect data
  const data = await collectWeekData(weekStart, weekEnd, vinNotes);
  const { arc, next_episode_number } = await fetchLatestArcState();

  // Generate via Léa
  const draft = await generateLetterDraft({
    episodeNumber: next_episode_number,
    weekStart,
    weekEnd,
    arcState: arc as LetterArcState,
    data,
  });

  if (!draft) {
    logger.error("[letters] generation failed, no provider succeeded");
    return null;
  }

  // Insert
  const { data: inserted } = await admin
    .from("weekly_letters")
    .insert({
      episode_number: next_episode_number,
      week_start: weekStart.toISOString().slice(0, 10),
      week_end: weekEnd.toISOString().slice(0, 10),
      status: "draft",
      title: draft.title,
      subject: draft.subject,
      intro_narrative: draft.intro_narrative,
      new_cliffhanger: draft.new_cliffhanger,
      generated_data: data,
      arc_state_snapshot: draft.arc_state_update,
    })
    .select("id, episode_number")
    .single();

  if (!inserted) {
    logger.error("[letters] insert failed");
    return null;
  }

  logger.info("[letters] new draft created", {
    id: inserted.id,
    episode: inserted.episode_number,
  });

  return {
    id: inserted.id,
    episode_number: inserted.episode_number,
    was_existing: false,
  };
}
