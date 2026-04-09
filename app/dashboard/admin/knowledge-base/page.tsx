import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { AdminKbEditor } from "./_components/admin-kb-editor";

export default async function AdminKbPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!env.ADMIN_USER_ID || user?.id !== env.ADMIN_USER_ID) {
    redirect("/dashboard");
  }

  const admin = createAdminClient();
  const { data: articles } = await admin
    .from("support_kb_articles")
    .select("*")
    .order("category", { ascending: true })
    .order("position", { ascending: true });

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href="/dashboard/admin">
          <ArrowLeft className="size-4" />
          Back to admin
        </Link>
      </Button>
      <div className="flex flex-col gap-1">
        <h1 className="text-base font-semibold">Knowledge base</h1>
        <p className="text-muted-foreground text-xs">
          Articles Léa uses to answer users
        </p>
      </div>
      <AdminKbEditor initialArticles={articles ?? []} />
    </div>
  );
}
