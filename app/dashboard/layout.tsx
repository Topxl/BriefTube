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

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status, trial_ends_at")
    .eq("id", user.id)
    .single();

  const isInTrial =
    profile?.trial_ends_at != null &&
    new Date(profile.trial_ends_at) > new Date();
  const effectivePlan =
    profile?.subscription_status === "active"
      ? "active"
      : isInTrial
        ? "trial"
        : "free";

  return (
    <div className="bg-background min-h-screen">
      <DashboardNav email={user.email || ""} plan={effectivePlan} />
      <div className="mx-auto max-w-[1080px] px-4 py-5 pb-24 md:px-6 md:py-6 md:pb-6">
        {children}
      </div>
    </div>
  );
}
