import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/auth/require-admin-api";

/**
 * GET /api/admin/chat/list?status=pending_human|active|resolved|all&limit=50
 * Returns conversations + the latest user/assistant message preview + user email.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status") ?? "all";
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") ?? "50", 10), 1),
    200,
  );

  const admin = createAdminClient();

  let query = admin
    .from("chat_conversations")
    .select(
      "id, user_id, status, subject, escalated_at, escalation_reason, resolved_at, last_message_at, unread_by_admin, created_at, profiles!chat_conversations_user_id_fkey(email, subscription_status)",
    )
    .order("last_message_at", { ascending: false })
    .limit(limit);

  if (statusParam !== "all") {
    query = query.eq("status", statusParam);
  }

  const { data: conversations, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Counts for the inbox header (cheap separate queries)
  const [pendingHumanCount, activeCount, resolvedCount, unreadCount] =
    await Promise.all([
      admin
        .from("chat_conversations")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending_human"),
      admin
        .from("chat_conversations")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      admin
        .from("chat_conversations")
        .select("id", { count: "exact", head: true })
        .eq("status", "resolved"),
      admin
        .from("chat_conversations")
        .select("id", { count: "exact", head: true })
        .eq("unread_by_admin", true),
    ]);

  return NextResponse.json({
    conversations,
    counts: {
      pending_human: pendingHumanCount.count ?? 0,
      active: activeCount.count ?? 0,
      resolved: resolvedCount.count ?? 0,
      unread: unreadCount.count ?? 0,
    },
  });
}
