import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/auth/require-admin-api";
import type { TablesUpdate } from "@/types/supabase";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  status: z
    .enum(["active", "pending_human", "resolved", "archived"])
    .optional(),
  unread_by_admin: z.boolean().optional(),
  mark_read: z.boolean().optional(),
});

/**
 * GET /api/admin/chat/[id]
 * Returns full conversation + all messages + user profile snapshot.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: conversation } = await admin
    .from("chat_conversations")
    .select(
      "id, user_id, status, subject, escalated_at, escalation_reason, resolved_at, last_message_at, unread_by_admin, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!conversation) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 },
    );
  }

  const [{ data: messages }, { data: profile }] = await Promise.all([
    admin
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true }),
    admin
      .from("profiles")
      .select(
        "id, email, subscription_status, max_channels, telegram_connected, preferred_language, trial_ends_at, onboarding_completed, created_at",
      )
      .eq("id", conversation.user_id)
      .maybeSingle(),
  ]);

  return NextResponse.json({
    conversation,
    messages: messages ?? [],
    user_profile: profile,
  });
}

/**
 * PATCH /api/admin/chat/[id]
 * Update status, mark read, archive, etc.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid body" },
      { status: 400 },
    );
  }

  const updates: TablesUpdate<"chat_conversations"> = {};
  if (parsed.data.status) {
    updates.status = parsed.data.status;
    if (parsed.data.status === "resolved") {
      updates.resolved_at = new Date().toISOString();
    }
  }
  if (parsed.data.mark_read || parsed.data.unread_by_admin === false) {
    updates.unread_by_admin = false;
  } else if (parsed.data.unread_by_admin === true) {
    updates.unread_by_admin = true;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: updated } = await admin
    .from("chat_conversations")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  return NextResponse.json({ ok: true, conversation: updated });
}
