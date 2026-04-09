import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/auth/require-admin-api";
import { renderWeeklyLetterHtml } from "@/lib/letters/render";
import { sendEmail } from "@/lib/mail/send-email";
import { getAdminEmail } from "@/lib/lea/notifications";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/letters/[id]/test-send
 * Sends the rendered letter ONLY to the admin email (Vin) for preview.
 * Does not change letter status.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: letter } = await admin
    .from("weekly_letters")
    .select("episode_number, title, subject, intro_narrative")
    .eq("id", id)
    .maybeSingle();

  if (!letter)
    return NextResponse.json({ error: "Letter not found" }, { status: 404 });
  if (!letter.intro_narrative || !letter.title || !letter.subject) {
    return NextResponse.json(
      { error: "Letter is missing fields" },
      { status: 400 },
    );
  }

  const adminEmail = await getAdminEmail();
  if (!adminEmail)
    return NextResponse.json(
      { error: "ADMIN_USER_ID not configured" },
      { status: 500 },
    );

  const html = await renderWeeklyLetterHtml({
    episodeNumber: letter.episode_number,
    title: letter.title,
    introNarrativeMarkdown: letter.intro_narrative,
    unsubscribeUrl: "https://www.brief-tube.com/dashboard/profile",
  });

  await sendEmail({
    to: adminEmail,
    subject: `[TEST] ${letter.subject}`,
    html,
  });

  return NextResponse.json({ ok: true, sent_to: adminEmail });
}
