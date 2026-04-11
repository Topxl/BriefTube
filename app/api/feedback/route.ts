import { authRoute } from "@/lib/zod-route";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { checkRateLimit, authRateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  message: z.string().min(1).max(2000),
  source: z.string().max(50).default("onboarding"),
});

type Body = z.infer<typeof bodySchema>;

/**
 * POST /api/feedback
 * Simple feedback endpoint. Creates a chat_conversation + chat_message
 * tagged with the source, without invoking Léa. Shows up in the admin
 * support inbox as a user message with status pending_human.
 */
export const POST = authRoute
  .body(bodySchema)
  .handler(async (_req, { body, ctx }) => {
    const rl = await checkRateLimit(authRateLimit, `feedback:${ctx.user.id}`);
    if (rl) return rl;

    const { message, source } = body as Body;
    const admin = createAdminClient();

    // Create a conversation marked for human review
    const { data: conv } = await admin
      .from("chat_conversations")
      .insert({
        user_id: ctx.user.id,
        status: "pending_human",
        subject: `[${source}] Feedback`,
        unread_by_admin: true,
      })
      .select()
      .single();

    if (!conv) {
      return { ok: false, error: "Failed to create conversation" };
    }

    // Insert the user message
    await admin.from("chat_messages").insert({
      conversation_id: conv.id,
      role: "user",
      content: `[${source}] ${message}`,
      metadata: { source },
    });

    return { ok: true };
  });
