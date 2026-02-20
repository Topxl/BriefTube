import { createClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "@/components/dashboard/onboarding-wizard";
import { getRequiredUser } from "@/lib/auth/auth-user";
import { SiteConfig } from "@/site-config";
import { Suspense } from "react";

export default async function OnboardingPage() {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("tts_voice")
    .eq("id", user.id)
    .single();

  const initialVoice = profile?.tts_voice ?? SiteConfig.defaultTtsVoice;

  return (
    <Suspense fallback={null}>
      <OnboardingWizard initialVoice={initialVoice} />
    </Suspense>
  );
}
