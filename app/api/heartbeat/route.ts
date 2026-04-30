import { authRoute } from "@/lib/zod-route";
import { createAdminClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * Marks "today" as an active day for the authenticated user. Called from the
 * dashboard layout on every visit, idempotent — the (user_id, day) primary key
 * collapses repeated calls within the same UTC day to a single row.
 *
 * Drives the StatsSheet streak.
 */
export const POST = authRoute.handler(async (_req, { ctx }) => {
  const today = new Date().toISOString().slice(0, 10);
  const admin = createAdminClient();
  // Table just landed via migration — not in the generated supabase types yet,
  // so we cast `from()` locally rather than regenerate the 52 KB types file.
  const { error } = await (
    admin.from as unknown as (table: string) => {
      upsert: (
        row: { user_id: string; day: string },
        opts: { onConflict: string; ignoreDuplicates: boolean },
      ) => Promise<{ error: { message: string } | null }>;
    }
  )("user_active_days").upsert(
    { user_id: ctx.user.id, day: today },
    { onConflict: "user_id,day", ignoreDuplicates: true },
  );
  if (error) {
    logger.error("heartbeat upsert failed", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, day: today };
});
