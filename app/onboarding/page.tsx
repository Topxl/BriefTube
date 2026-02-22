import { createClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "@/components/dashboard/onboarding-wizard";
import { getRequiredUser } from "@/lib/auth/auth-user";
import { SiteConfig } from "@/site-config";
import { Suspense } from "react";

export default async function OnboardingPage() {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const [{ data: profile }, { data: listsRaw }] = await Promise.all([
    supabase
      .from("profiles")
      .select("tts_voice, referral_code")
      .eq("id", user.id)
      .single(),
    supabase
      .from("channel_lists")
      .select("id, name, description, category, list_channels(count)")
      .eq("is_public", true)
      .order("name"),
  ]);

  const initialVoice = profile?.tts_voice ?? SiteConfig.defaultTtsVoice;
  const referralCode = profile?.referral_code ?? undefined;

  const curatedLists = (listsRaw ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    description: l.description ?? null,
    category: l.category ?? null,
    channelCount:
      (l.list_channels as unknown as { count: number }[])[0]?.count ?? 0,
  }));

  return (
    <Suspense fallback={null}>
      <OnboardingWizard
        initialVoice={initialVoice}
        referralCode={referralCode}
        curatedLists={curatedLists}
      />
    </Suspense>
  );
}
