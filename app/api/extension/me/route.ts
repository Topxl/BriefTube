import { NextResponse } from "next/server";
import { z } from "zod";
import { corsPreflight, extensionRoute } from "@/lib/extension-route";
import { getUserQuotaSnapshot } from "@/lib/extension-quota";
import { createAdminClient } from "@/lib/supabase/server";

export const OPTIONS = corsPreflight;

const patchSchema = z.object({
  preferredLanguage: z.string().min(2).max(10).optional(),
});
type PatchBody = z.infer<typeof patchSchema>;

export const PATCH = extensionRoute
  .requireAuthenticated()
  .body(patchSchema)
  .handler(async (_req, { body, user }) => {
    if (!user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    const { preferredLanguage } = body as PatchBody;
    if (!preferredLanguage) {
      return { ok: true };
    }
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("profiles")
      .update({ preferred_language: preferredLanguage })
      .eq("id", user.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return { ok: true };
  });

export const GET = extensionRoute.handler(async (_req, { user }) => {
  if (!user) {
    return {
      authenticated: false,
      user: null,
      quota: null,
    };
  }

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, email, preferred_language, tts_voice, summary_length_pref, summary_style, extension_installed_at",
    )
    .eq("id", user.id)
    .single();

  if (profile && !profile.extension_installed_at) {
    await supabase
      .from("profiles")
      .update({ extension_installed_at: new Date().toISOString() })
      .eq("id", user.id);
  }

  const quota = await getUserQuotaSnapshot(user.id);
  return {
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      avatarUrl: user.avatarUrl,
      preferredLanguage: profile?.preferred_language ?? "en",
      ttsVoice: profile?.tts_voice ?? null,
      summaryLengthPref: profile?.summary_length_pref ?? "auto",
      summaryStyle: profile?.summary_style ?? "narrative",
    },
    quota: {
      isPro: quota.isPro,
      limit: Number.isFinite(quota.limit) ? quota.limit : null,
      used: quota.used,
      remaining: Number.isFinite(quota.remaining) ? quota.remaining : null,
      resetAtIso: quota.resetAtIso,
    },
  };
});
