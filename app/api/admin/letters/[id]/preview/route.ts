import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/auth/require-admin-api";
import { renderWeeklyLetterHtml } from "@/lib/letters/render";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/letters/[id]/preview
 * Returns the rendered HTML email body. Used by the admin editor preview pane.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const admin = createAdminClient();

  const { data: letter } = await admin
    .from("weekly_letters")
    .select("episode_number, title, intro_narrative")
    .eq("id", id)
    .maybeSingle();

  if (!letter)
    return NextResponse.json({ error: "Letter not found" }, { status: 404 });

  if (!letter.intro_narrative || !letter.title) {
    return NextResponse.json(
      { error: "Letter is missing title or body" },
      { status: 400 },
    );
  }

  const html = await renderWeeklyLetterHtml({
    episodeNumber: letter.episode_number,
    title: letter.title,
    introNarrativeMarkdown: letter.intro_narrative,
    unsubscribeUrl: "https://www.brief-tube.com/dashboard/profile",
  });

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
