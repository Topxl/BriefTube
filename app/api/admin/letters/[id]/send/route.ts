import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/auth/require-admin-api";
import { renderWeeklyLetterHtml } from "@/lib/letters/render";
import { sendEmail } from "@/lib/mail/send-email";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/letters/[id]/send
 * Send the letter to all subscribers (profiles where email_newsletter=true).
 * Marks the letter as sent + records recipient_count.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: letter } = await admin
    .from("weekly_letters")
    .select("id, episode_number, title, subject, intro_narrative, status")
    .eq("id", id)
    .maybeSingle();

  if (!letter)
    return NextResponse.json({ error: "Letter not found" }, { status: 404 });
  if (letter.status === "sent")
    return NextResponse.json({ error: "Letter already sent" }, { status: 409 });
  if (!letter.intro_narrative || !letter.title || !letter.subject) {
    return NextResponse.json(
      { error: "Letter is missing fields" },
      { status: 400 },
    );
  }

  // Recipients: paginate through profiles with email_newsletter=true
  const recipients: { id: string; email: string }[] = [];
  let offset = 0;
  const pageSize = 1000;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const { data: page } = await admin
      .from("profiles")
      .select("id, email")
      .eq("email_newsletter", true)
      .range(offset, offset + pageSize - 1);
    if (!page || page.length === 0) break;
    recipients.push(...page.filter((p) => Boolean(p.email)));
    if (page.length < pageSize) break;
    offset += pageSize;
  }

  if (recipients.length === 0) {
    return NextResponse.json(
      { error: "No subscribers (email_newsletter=true)" },
      { status: 409 },
    );
  }

  const html = await renderWeeklyLetterHtml({
    episodeNumber: letter.episode_number,
    title: letter.title,
    introNarrativeMarkdown: letter.intro_narrative,
    unsubscribeUrl: "https://www.brief-tube.com/dashboard/profile",
  });

  // Send in parallel batches of 10 to avoid hammering Resend
  const BATCH = 10;
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < recipients.length; i += BATCH) {
    const batch = recipients.slice(i, i + BATCH);
    // eslint-disable-next-line no-await-in-loop
    const results = await Promise.allSettled(
      batch.map(async (r) =>
        sendEmail({
          to: r.email,
          subject: letter.subject ?? `Episode ${letter.episode_number}`,
          html,
        }),
      ),
    );
    for (const r of results) {
      if (r.status === "fulfilled" && !r.value.error) sent++;
      else failed++;
    }
  }

  // Mark as sent
  await admin
    .from("weekly_letters")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      recipient_count: sent,
    })
    .eq("id", id);

  logger.info("[letters] letter sent", {
    id,
    episode: letter.episode_number,
    sent,
    failed,
  });

  return NextResponse.json({ ok: true, sent, failed });
}
