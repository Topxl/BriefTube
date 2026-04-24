import { authRoute } from "@/lib/zod-route";
import { z } from "zod";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { askLea } from "@/lib/lea/client";
import { checkRateLimit, heavyRateLimit } from "@/lib/rate-limit";
import {
  notifyAdminEscalation,
  notifyAdminNewFeatureDetected,
} from "@/lib/lea/notifications";
import type { LeaMessage } from "@/lib/lea/types";
import type { TablesUpdate } from "@/types/supabase";

const bodySchema = z.object({
  conversationId: z.string().uuid(),
  message: z.string().min(1).max(2000),
});

type Body = z.infer<typeof bodySchema>;

// Léa writes a markdown link like [her friendly label](FEATURE_URL_PLACEHOLDER)
// and the server only swaps the URL token. That way the visible text stays in
// the user's language and the link is clickable.
const FEATURE_URL_PLACEHOLDER = "FEATURE_URL_PLACEHOLDER";

/**
 * POST /api/chat/ask
 * Send a user message in an existing conversation. Returns Léa's reply.
 *
 * Side effects when Léa detects a feature request:
 *   - auto-creates a feature_requests row with needs_admin_review=true
 *   - auto-votes (the proposer counts as 1 vote)
 *   - replaces FEATURE_URL_PLACEHOLDER in Léa's reply with the actual link
 *   - emails the admin (Vin) so he can approve/reject
 *
 * Side effects on escalation:
 *   - sets conversation status=pending_human
 *   - emails the admin
 */
export const POST = authRoute
  .body(bodySchema)
  .handler(async (_req, { body, ctx }) => {
    const rl = await checkRateLimit(heavyRateLimit, `lea:${ctx.user.id}`);
    if (rl) return rl;

    const { conversationId, message } = body as Body;
    const admin = createAdminClient();

    // 1. Verify the conversation belongs to the current user
    const { data: conv } = await admin
      .from("chat_conversations")
      .select("id, user_id, status, subject, escalated_at")
      .eq("id", conversationId)
      .maybeSingle();

    if (conv?.user_id !== ctx.user.id) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    if (conv.status === "archived") {
      return NextResponse.json(
        { error: "Conversation archived" },
        { status: 409 },
      );
    }

    // 2. Fetch history (last 20 messages, chronological)
    const { data: historyData } = await admin
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(20);
    const history = (historyData ?? []) as LeaMessage[];
    const isFirstTurn = history.length === 0;

    // 3. Insert the user message
    const { data: userMsg } = await admin
      .from("chat_messages")
      .insert({
        conversation_id: conversationId,
        role: "user",
        content: message,
        metadata: {},
      })
      .select()
      .single();

    if (!userMsg) {
      return NextResponse.json(
        { error: "Failed to save message" },
        { status: 500 },
      );
    }

    // 4. Ask Léa
    const leaResponse = await askLea({
      userId: ctx.user.id,
      history,
      newMessage: message,
      isFirstTurn,
    });

    // 5. If Léa detected a feature request, auto-create it pending review
    let createdFeatureId: string | null = null;
    if (leaResponse.detected_feature_request) {
      const fr = leaResponse.detected_feature_request;

      // Check quota: max 5 pending features per user
      // Note: under high concurrency, parallel requests may both pass the count check
      // before either insert completes, allowing a brief +/-1 overrun. This is acceptable
      // to avoid complex transactional overhead; quota enforcement is advisory, not hard.
      const { count: pendingCount } = await admin
        .from("feature_requests")
        .select("id", { count: "exact", head: true })
        .eq("user_id", ctx.user.id)
        .eq("needs_admin_review", true);

      if ((pendingCount ?? 0) < 5) {
        const { data: createdFeature } = await admin
          .from("feature_requests")
          .insert({
            user_id: ctx.user.id,
            title: fr.title,
            description: fr.description,
            category: fr.category,
            status: "new",
            source: "chat_detected",
            needs_admin_review: true,
          })
          .select()
          .single();

        if (createdFeature) {
          createdFeatureId = createdFeature.id;

          // Auto-vote: the proposer counts as 1 vote
          await admin.from("feature_votes").insert({
            feature_request_id: createdFeature.id,
            user_id: ctx.user.id,
          });

          // Fire-and-forget admin notification
          void notifyAdminNewFeatureDetected({
            featureId: createdFeature.id,
            userId: ctx.user.id,
            title: fr.title,
            description: fr.description,
            category: fr.category,
          });
        }
      }
    }

    // 6. Replace the URL placeholder in Léa's message with the real URL.
    // Léa formatted her message as: [her label in user's language](FEATURE_URL_PLACEHOLDER)
    // We only swap the URL token so the friendly label is preserved.
    let finalLeaMessage = leaResponse.message;
    if (createdFeatureId) {
      const realUrl = `/features#${createdFeatureId}`;
      if (finalLeaMessage.includes(FEATURE_URL_PLACEHOLDER)) {
        finalLeaMessage = finalLeaMessage.replaceAll(
          FEATURE_URL_PLACEHOLDER,
          realUrl,
        );
      } else {
        // Fallback: Léa forgot the placeholder — append a generic link
        finalLeaMessage += `\n\n[→](${realUrl})`;
      }
    } else if (finalLeaMessage.includes(FEATURE_URL_PLACEHOLDER)) {
      // No feature was created (quota hit or insert failed) — strip any
      // markdown link that contains the placeholder so we don't render
      // a broken `[label](FEATURE_URL_PLACEHOLDER)` to the user.
      finalLeaMessage = finalLeaMessage.replace(
        /\[[^\]]*\]\(FEATURE_URL_PLACEHOLDER\)/g,
        "",
      );
    }

    // 7. Insert Léa's reply
    const { data: assistantMsg } = await admin
      .from("chat_messages")
      .insert({
        conversation_id: conversationId,
        role: "assistant",
        content: finalLeaMessage,
        metadata: {
          should_escalate: leaResponse.should_escalate,
          escalation_reason: leaResponse.escalation_reason,
          confidence: leaResponse.confidence,
          detected_feature_request: leaResponse.detected_feature_request,
          created_feature_id: createdFeatureId,
        },
      })
      .select()
      .single();

    // 8. Update the conversation if needed (subject + escalation)
    const updates: TablesUpdate<"chat_conversations"> = {};
    if (isFirstTurn && leaResponse.conversation_subject) {
      updates.subject = leaResponse.conversation_subject;
    }
    if (leaResponse.should_escalate && conv.status !== "pending_human") {
      updates.status = "pending_human";
      updates.escalated_at = new Date().toISOString();
      updates.escalation_reason = leaResponse.escalation_reason;
    }
    if (Object.keys(updates).length > 0) {
      await admin
        .from("chat_conversations")
        .update(updates)
        .eq("id", conversationId);
    }

    // 9. Admin notification email on escalation (throttle to one per conversation per hour)
    if (leaResponse.should_escalate) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const alreadyEscalatedRecently =
        conv.escalated_at && new Date(conv.escalated_at) > new Date(oneHourAgo);

      if (!alreadyEscalatedRecently) {
        void notifyAdminEscalation({
          conversationId,
          userId: ctx.user.id,
          userMessage: message,
          leaMessage: finalLeaMessage,
          reason: leaResponse.escalation_reason ?? "unknown",
          subject:
            leaResponse.conversation_subject ?? conv.subject ?? "No subject",
        });
      }
    }

    return {
      ok: true,
      user_message: userMsg,
      assistant_message: assistantMsg,
      meta: {
        should_escalate: leaResponse.should_escalate,
        escalation_reason: leaResponse.escalation_reason,
        detected_feature_request: leaResponse.detected_feature_request,
        created_feature_id: createdFeatureId,
        confidence: leaResponse.confidence,
      },
    };
  });
