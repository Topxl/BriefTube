import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/auth/require-admin-api";
import { generateAndStoreWeeklyLetter } from "@/lib/letters/generate-letter";

/**
 * GET /api/admin/letters
 * List all weekly letters (drafts + scheduled + sent), most recent first.
 */
export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data: letters, error } = await admin
    .from("weekly_letters")
    .select(
      "id, episode_number, week_start, week_end, status, title, subject, scheduled_at, sent_at, recipient_count, created_at, updated_at",
    )
    .order("episode_number", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ letters });
}

/**
 * POST /api/admin/letters
 * Manually trigger generation of a new weekly letter draft.
 * Body: { vin_notes?: string, force?: boolean }
 */
export async function POST(req: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let body: { vin_notes?: string; force?: boolean } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* empty body OK */
  }

  const result = await generateAndStoreWeeklyLetter({
    vinNotes: body.vin_notes ?? null,
    force: body.force ?? false,
  });

  if (!result) {
    return NextResponse.json(
      {
        error:
          "Generation failed. Check server logs (gemini/openrouter outage?).",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    id: result.id,
    episode_number: result.episode_number,
    was_existing: result.was_existing,
  });
}
