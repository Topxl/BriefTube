import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import Link from "next/link";

export default async function OnboardingLayout({
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
    .select("onboarding_completed")
    .eq("id", user.id)
    .single();

  if (profile?.onboarding_completed) {
    redirect("/dashboard");
  }

  return (
    <div className="bg-background min-h-screen">
      <header className="flex h-14 items-center px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.svg" alt="BriefTube" width={26} height={26} suppressHydrationWarning />
          <span className="text-sm font-semibold">BriefTube</span>
        </Link>
      </header>

      <div className="mx-auto max-w-lg px-4 pt-8 pb-16 md:pt-12">
        {children}
      </div>
    </div>
  );
}
