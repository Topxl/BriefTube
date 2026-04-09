import { redirect, notFound } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { SupportConversationView } from "../_components/support-conversation-view";

export default async function AdminSupportConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!env.ADMIN_USER_ID || user?.id !== env.ADMIN_USER_ID) {
    redirect("/dashboard");
  }

  const admin = createAdminClient();

  const { data: conversation } = await admin
    .from("chat_conversations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!conversation) {
    notFound();
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

  // Mark as read on view
  if (conversation.unread_by_admin) {
    await admin
      .from("chat_conversations")
      .update({ unread_by_admin: false })
      .eq("id", id);
  }

  return (
    <SupportConversationView
      conversation={
        conversation as unknown as Parameters<
          typeof SupportConversationView
        >[0]["conversation"]
      }
      initialMessages={
        (messages ?? []) as unknown as Parameters<
          typeof SupportConversationView
        >[0]["initialMessages"]
      }
      userProfile={profile}
    />
  );
}
