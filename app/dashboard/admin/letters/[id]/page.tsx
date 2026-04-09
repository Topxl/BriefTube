import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { LetterEditor } from "../_components/letter-editor";

export default async function AdminLetterEditPage({
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
  const { data: letter } = await admin
    .from("weekly_letters")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!letter) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href="/dashboard/admin/letters">
          <ArrowLeft className="size-4" />
          Back to letters
        </Link>
      </Button>
      <LetterEditor
        initialLetter={
          letter as unknown as Parameters<
            typeof LetterEditor
          >[0]["initialLetter"]
        }
      />
    </div>
  );
}
