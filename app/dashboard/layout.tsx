import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { DashboardNav } from "@/components/dashboard/nav";
// Only identify users in the dashboard — avoids loading Supabase client on the landing page
import { PostHogIdentify } from "@/components/posthog/posthog-identify";
import { YouTubeSyncDialog } from "@/components/dashboard/youtube-sync-dialog";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="bg-background min-h-screen">
      <Suspense fallback={null}>
        <PostHogIdentify />
      </Suspense>
      <DashboardNav />
      <div className="mx-auto max-w-[1080px] px-4 pt-1 pb-24 md:px-6 md:pt-2 md:pb-6">
        {children}
      </div>
      <Suspense fallback={null}>
        <YouTubeSyncDialog />
      </Suspense>
    </div>
  );
}
