import { authRoute } from "@/lib/zod-route";
import { z } from "zod";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { notifyAdminEscalation } from "@/lib/lea/notifications";
import { checkRateLimit, authRateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  conversationId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

type Body = z.infer<typeof bodySchema>;

/**
 * POST /api/chat/escalate
 * Manual escalation triggered by the user (clicking "Pas utile, contacter Vin").
 * Marks the conversation as pending_human and notifies the admin.
 */
export const POST = authRoute
  .body(bodySchema)
  .handler(async (_req, { body, ctx }) => {
    const rl = await checkRateLimit(
      authRateLimit,
      `chat-escalate:${ctx.user.id}`,
    );
    if (rl) return rl;

    const { conversationId, reason } = body as Body;
    const admin = createAdminClient();

    const { data: conv } = await admin
      .from("chat_conversations")
      .select("id, user_id, status, subject")
      .eq("id", conversationId)
      .maybeSingle();

    if (conv?.user_id !== ctx.user.id) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    const escalationReason = reason ?? "user_requested_human";

    if (conv.status !== "pending_human") {
      await admin
        .from("chat_conversations")
        .update({
          status: "pending_human",
          escalated_at: new Date().toISOString(),
          escalation_reason: escalationReason,
          unread_by_admin: true,
        })
        .eq("id", conversationId);
    }

    // Fetch the latest user message to include in the notification
    const { data: lastUserMsg } = await admin
      .from("chat_messages")
      .select("content")
      .eq("conversation_id", conversationId)
      .eq("role", "user")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    void notifyAdminEscalation({
      conversationId,
      userId: ctx.user.id,
      userMessage: lastUserMsg?.content ?? "(aucun message)",
      leaMessage: "(escalade manuelle demandée par l'utilisateur)",
      reason: escalationReason,
      subject: conv.subject ?? "Sans sujet",
    });

    return { ok: true, status: "pending_human" };
  });
