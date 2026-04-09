import { readFile } from "node:fs/promises";
import path from "node:path";
import { createAdminClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { EMPTY_ARC_STATE } from "./types";
import type { LetterArcState, LetterGeneratedData } from "./types";

const CHANGELOG_PATH = path.join(process.cwd(), "CHANGELOG.md");

/**
 * Parse CHANGELOG.md and extract entries between the given dates.
 * Only keeps user-facing entries (FEATURE / FIX), drops CHORE/REFACTOR/etc.
 */
export async function parseChangelogForWeek(
  weekStart: Date,
  weekEnd: Date,
): Promise<LetterGeneratedData["changelog_entries"]> {
  let raw: string;
  try {
    raw = await readFile(CHANGELOG_PATH, "utf-8");
  } catch (error) {
    logger.warn("[letters] CHANGELOG.md not readable", {
      error: String(error),
    });
    return [];
  }

  const entries: LetterGeneratedData["changelog_entries"] = [];
  const dateHeaderRe = /^## (\d{4}-\d{2}-\d{2})\s*$/m;
  const lines = raw.split("\n");
  let currentDate: string | null = null;

  for (const line of lines) {
    const dateMatch = dateHeaderRe.exec(line);
    if (dateMatch) {
      currentDate = dateMatch[1];
      continue;
    }
    if (!currentDate) continue;

    // Check if date is in our window
    const d = new Date(currentDate);
    if (d < weekStart || d > weekEnd) continue;

    // Parse entry: "FEATURE: description" or "FIX: description"
    const entryMatch = /^(FEATURE|FIX):\s*(.+)$/.exec(line.trim());
    if (entryMatch) {
      const type = entryMatch[1] as "FEATURE" | "FIX";
      const text = entryMatch[2];
      if (text.length > 0) {
        entries.push({ date: currentDate, type, text });
      }
    }
  }

  return entries;
}

/**
 * Fetch features that were marked "shipped" in the given week.
 */
async function fetchShippedFeatures(
  weekStart: Date,
  weekEnd: Date,
): Promise<LetterGeneratedData["features_shipped"]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("feature_requests")
    .select(
      "id, title, description, votes_count, profiles!feature_requests_user_id_fkey(email)",
    )
    .eq("status", "shipped")
    .gte("updated_at", weekStart.toISOString())
    .lte("updated_at", weekEnd.toISOString())
    .order("votes_count", { ascending: false });

  return (data ?? []).map((f) => ({
    id: f.id,
    title: f.title,
    description: f.description,
    votes_count: f.votes_count,
    proposer_email: (f.profiles as { email?: string } | null)?.email ?? null,
  }));
}

/**
 * Aggregate light stats for the week. Used to give Léa some color.
 */
async function fetchWeekStats(
  weekStart: Date,
  weekEnd: Date,
): Promise<LetterGeneratedData["stats"]> {
  const admin = createAdminClient();

  const [newUsersRes, activeUsersRes, processedRes] = await Promise.all([
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", weekStart.toISOString())
      .lte("created_at", weekEnd.toISOString()),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("subscription_status", "active"),
    admin
      .from("processed_videos")
      .select("video_id", { count: "exact", head: true })
      .gte("processed_at", weekStart.toISOString())
      .lte("processed_at", weekEnd.toISOString())
      .eq("status", "completed"),
  ]);

  return {
    new_users_count: newUsersRes.count ?? 0,
    active_users_count: activeUsersRes.count ?? 0,
    summaries_processed: processedRes.count ?? 0,
  };
}

/**
 * Resolve the most recent letter's arc state, or seed a new one.
 */
export async function fetchLatestArcState(): Promise<{
  arc: LetterArcState;
  next_episode_number: number;
}> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("weekly_letters")
    .select("episode_number, arc_state_snapshot, status")
    .order("episode_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return { arc: EMPTY_ARC_STATE, next_episode_number: 1 };
  }

  // Use the snapshot if it looks valid, otherwise reset
  const snapshot = data.arc_state_snapshot as Partial<LetterArcState>;
  const isValid =
    typeof snapshot === "object" &&
    typeof snapshot.current_arc_title === "string";
  const arc: LetterArcState = isValid
    ? { ...EMPTY_ARC_STATE, ...snapshot }
    : EMPTY_ARC_STATE;

  return {
    arc,
    next_episode_number: data.episode_number + 1,
  };
}

/**
 * Collect everything Léa needs to generate the next weekly letter.
 */
export async function collectWeekData(
  weekStart: Date,
  weekEnd: Date,
  vinNotes: string | null = null,
): Promise<LetterGeneratedData> {
  const [features, changelog, stats] = await Promise.all([
    fetchShippedFeatures(weekStart, weekEnd),
    parseChangelogForWeek(weekStart, weekEnd),
    fetchWeekStats(weekStart, weekEnd),
  ]);

  return {
    features_shipped: features,
    changelog_entries: changelog,
    stats,
    vin_notes: vinNotes,
  };
}

/**
 * Compute the week window: Monday → Sunday inclusive containing the given
 * reference date (or "today" if not provided).
 */
export function getWeekWindow(reference: Date = new Date()): {
  weekStart: Date;
  weekEnd: Date;
} {
  const ref = new Date(reference);
  ref.setUTCHours(0, 0, 0, 0);

  // ISO week: Monday = 1, Sunday = 7
  const day = ref.getUTCDay() === 0 ? 7 : ref.getUTCDay();
  const weekStart = new Date(ref);
  weekStart.setUTCDate(ref.getUTCDate() - (day - 1));
  weekStart.setUTCHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  return { weekStart, weekEnd };
}
