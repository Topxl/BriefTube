import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { SupportInbox } from "./_components/support-inbox";

export default async function AdminSupportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!env.ADMIN_USER_ID || user?.id !== env.ADMIN_USER_ID) {
    redirect("/dashboard");
  }

  const admin = createAdminClient();
  const { data: conversations } = await admin
    .from("chat_conversations")
    .select(
      "id, user_id, status, subject, escalated_at, escalation_reason, last_message_at, unread_by_admin, created_at, profiles!chat_conversations_user_id_fkey(email, subscription_status)",
    )
    .order("last_message_at", { ascending: false })
    .limit(100);

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href="/dashboard/admin">
          <ArrowLeft className="size-4" />
          Back to admin
        </Link>
      </Button>
      <div className="flex flex-col gap-1">
        <h1 className="text-base font-semibold">Support inbox</h1>
        <p className="text-muted-foreground text-xs">
          Léa conversations & user requests
        </p>
      </div>
      <SupportInbox
        initialConversations={
          (conversations ?? []) as unknown as Parameters<
            typeof SupportInbox
          >[0]["initialConversations"]
        }
      />
    </div>
  );
}
