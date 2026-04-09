import { authRoute } from "@/lib/zod-route";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { checkRateLimit, authRateLimit } from "@/lib/rate-limit";

/**
 * GET /api/chat/conversations
 * Returns the user's most recent non-archived conversation with its messages,
 * or { conversation: null, messages: [] } if none exists.
 */
export const GET = authRoute.handler(async (_req, { ctx }) => {
  const admin = createAdminClient();

  const { data: conversation } = await admin
    .from("chat_conversations")
    .select("*")
    .eq("user_id", ctx.user.id)
    .neq("status", "archived")
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conversation) {
    return { conversation: null, messages: [] };
  }

  const { data: messages } = await admin
    .from("chat_messages")
    .select("*")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true })
    .limit(100);

  return { conversation, messages: messages ?? [] };
});

/**
 * POST /api/chat/conversations
 * Creates a brand new conversation for the current user.
 */
export const POST = authRoute.handler(async (_req, { ctx }) => {
  const rl = await checkRateLimit(authRateLimit, `chat-conv:${ctx.user.id}`);
  if (rl) return rl;

  const admin = createAdminClient();

  const { data: conversation } = await admin
    .from("chat_conversations")
    .insert({
      user_id: ctx.user.id,
      status: "active",
    })
    .select()
    .single();

  if (!conversation) {
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 },
    );
  }

  return { conversation, messages: [] };
});
