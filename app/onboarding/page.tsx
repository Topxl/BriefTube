import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "@/components/dashboard/onboarding-wizard";
import { getRequiredUser } from "@/lib/auth/auth-user";
import { SiteConfig } from "@/site-config";
import { languages } from "@/lib/languages";
import { Suspense } from "react";

/** Parse "fr-FR,fr;q=0.9,en-US;q=0.8" → "fr" */
function parsePrimaryLanguageCode(acceptLanguage: string): string | null {
  const primary = acceptLanguage.split(",")[0]?.split(";")[0]?.trim();
  if (!primary) return null;
  return primary.split("-")[0]?.toLowerCase() ?? null;
}

export default async function OnboardingPage() {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const headerStore = await headers();
  const acceptLanguage = headerStore.get("accept-language") ?? "";
  const langCode = parsePrimaryLanguageCode(acceptLanguage);
  const detectedVoice = langCode
    ? (languages.find((l) => l.code === langCode)?.voice ?? null)
    : null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tts_voice, referral_code")
    .eq("id", user.id)
    .single();

  // Auto-apply detected language when the profile still has the system default
  // (i.e. the user hasn't explicitly chosen a voice yet)
  const profileVoice = profile?.tts_voice ?? SiteConfig.defaultTtsVoice;
  const isDefaultVoice = profileVoice === SiteConfig.defaultTtsVoice;

  if (detectedVoice && isDefaultVoice && detectedVoice !== profileVoice) {
    const detectedLang = languages.find((l) => l.voice === detectedVoice);
    // Fire-and-forget — don't block the page render
    void supabase
      .from("profiles")
      .update({
        tts_voice: detectedVoice,
        preferred_language: detectedLang?.code ?? langCode ?? undefined,
      })
      .eq("id", user.id);
  }

  const referralCode = profile?.referral_code ?? undefined;

  return (
    <Suspense fallback={null}>
      <OnboardingWizard referralCode={referralCode} />
    </Suspense>
  );
}
