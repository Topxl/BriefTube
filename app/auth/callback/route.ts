import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { SiteConfig } from "@/site-config";
import { cookies } from "next/headers";

const REFERRAL_COOKIE = SiteConfig.referral.cookieName;

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const forwardedHost = request.headers.get("x-forwarded-host");

  logger.info("[auth/callback] START", {
    hasCode: !!code,
    origin,
    forwardedHost,
    next,
    url: request.url,
  });

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    logger.info("[auth/callback] exchangeCodeForSession", {
      success: !error,
      errorMessage: error?.message,
      errorStatus: error?.status,
    });

    if (!error) {
      // Set trial for new users (profile.trial_ends_at is null on first login)
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("trial_ends_at, referred_by")
          .eq("id", user.id)
          .single();

        if (profile?.trial_ends_at === null) {
          const trialEnd = new Date();
          trialEnd.setDate(trialEnd.getDate() + SiteConfig.trialDays);
          await supabase
            .from("profiles")
            .update({ trial_ends_at: trialEnd.toISOString() })
            .eq("id", user.id);
        }

        // Record referral if not already set
        if (profile?.referred_by === null) {
          const cookieStore = await cookies();
          const refCode = cookieStore.get(REFERRAL_COOKIE)?.value;

          if (refCode) {
            const { data: referrer } = await supabase
              .from("profiles")
              .select("id")
              .eq("referral_code", refCode)
              .single();

            if (referrer && referrer.id !== user.id) {
              await supabase
                .from("profiles")
                .update({ referred_by: referrer.id })
                .eq("id", user.id)
                .is("referred_by", null);

              const { error: insertError } = await supabase
                .from("referrals")
                .insert({ referrer_id: referrer.id, referee_id: user.id });

              if (insertError && insertError.code !== "23505") {
                logger.error("Failed to insert referral:", insertError);
              } else {
                logger.info("Referral recorded", {
                  referrerId: referrer.id,
                  refereeId: user.id,
                });
              }
            }
          }
        }
      }

      const isLocalEnv = process.env.NODE_ENV === "development";

      let redirectUrl: string;
      if (isLocalEnv) {
        redirectUrl = `${origin}${next}`;
      } else if (forwardedHost) {
        redirectUrl = `https://${forwardedHost}${next}`;
      } else {
        redirectUrl = `${origin}${next}`;
      }

      logger.info("[auth/callback] redirecting to", { redirectUrl });

      const response = NextResponse.redirect(redirectUrl);
      // Clear the referral cookie after processing
      response.cookies.delete(REFERRAL_COOKIE);
      return response;
    }
  }

  // Return to login if something went wrong
  logger.warn("[auth/callback] fallback redirect to /login", {
    hasCode: !!code,
    origin,
  });
  return NextResponse.redirect(`${origin}/login`);
}
