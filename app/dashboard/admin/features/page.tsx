import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { AdminFeaturesBoard } from "./_components/admin-features-board";

export default async function AdminFeaturesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!env.ADMIN_USER_ID || user?.id !== env.ADMIN_USER_ID) {
    redirect("/dashboard");
  }

  const admin = createAdminClient();
  const { data: features } = await admin
    .from("feature_requests")
    .select(
      "id, user_id, title, description, status, category, priority, votes_count, admin_notes, source, shipped_notification_sent, created_at, updated_at, profiles!feature_requests_user_id_fkey(email)",
    )
    .order("votes_count", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href="/dashboard/admin">
          <ArrowLeft className="size-4" />
          Back to admin
        </Link>
      </Button>
      <div className="flex flex-col gap-1">
        <h1 className="text-base font-semibold">Feature requests</h1>
        <p className="text-muted-foreground text-xs">
          Public roadmap. Manage status, priority, and notify users.
        </p>
      </div>
      <AdminFeaturesBoard
        initialFeatures={
          (features ?? []) as unknown as Parameters<
            typeof AdminFeaturesBoard
          >[0]["initialFeatures"]
        }
      />
    </div>
  );
}
