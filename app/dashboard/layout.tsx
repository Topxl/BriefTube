import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardNav } from "@/components/dashboard/nav";

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
      <DashboardNav />
      <div className="mx-auto max-w-[1080px] px-4 py-5 pb-24 md:px-6 md:py-6 md:pb-6">
        {children}
      </div>
    </div>
  );
}
