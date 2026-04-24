import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/auth/require-admin-api";
import { sendEmail } from "@/lib/mail/send-email";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  message: z.string().min(1).max(5000),
  resolve: z.boolean().optional(),
  notify_email: z.boolean().optional().default(true),
});

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * POST /api/admin/chat/[id]/reply
 * Admin replies to a conversation. Inserts an admin message,
 * marks the conversation as read, optionally resolves it,
 * and emails the user that there's a new reply.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id: conversationId } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid body" },
      { status: 400 },
    );
  }
  const { message, resolve, notify_email } = parsed.data;
  const admin = createAdminClient();

  // 1. Verify conversation exists
  const { data: conv } = await admin
    .from("chat_conversations")
    .select("id, user_id, subject")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conv) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 },
    );
  }

  // 2. Insert the admin message
  const { data: adminMsg } = await admin
    .from("chat_messages")
    .insert({
      conversation_id: conversationId,
      role: "admin",
      content: message,
      metadata: { sent_by_admin: true },
    })
    .select()
    .single();

  // 3. Mark conversation as read + optionally resolve
  await admin
    .from("chat_conversations")
    .update({
      unread_by_admin: false,
      ...(resolve
        ? { status: "resolved", resolved_at: new Date().toISOString() }
        : { status: "active" }),
    })
    .eq("id", conversationId);

  // 4. Email the user that there's a new reply
  if (notify_email) {
    void (async () => {
      try {
        const { data: userProfile } = await admin
          .from("profiles")
          .select("email")
          .eq("id", conv.user_id)
          .maybeSingle();

        if (!userProfile?.email) return;

        // Validate email format (defense-in-depth)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(userProfile.email)) {
          logger.warn("[admin/chat/reply] invalid email in profiles", {
            email: userProfile.email,
          });
          return;
        }

        const subject = conv.subject ?? "Your support request";
        const link = "https://www.brief-tube.com/dashboard";
        const html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; color: #1f2937;">
            <h2 style="margin: 0 0 16px;">New reply on your request</h2>
            <p style="color:#4b5563;">Vin replied to your conversation: <strong>${escapeHtml(subject)}</strong></p>
            <blockquote style="margin: 16px 0; border-left: 3px solid #d1d5db; padding: 12px; color: #1f2937; background: #f9fafb;">${escapeHtml(message)}</blockquote>
            <p style="margin: 24px 0 0;">
              <a href="${link}" style="background:#2563eb;color:white;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600;">Open chat on BriefTube →</a>
            </p>
          </div>
        `;
        await sendEmail({
          to: userProfile.email,
          subject: `Vin replied: ${subject}`,
          html,
        });
      } catch (error) {
        logger.error("[admin/chat/reply] notify user failed", { error });
      }
    })();
  }

  return NextResponse.json({ ok: true, message: adminMsg });
}
