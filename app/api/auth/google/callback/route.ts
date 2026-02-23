import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { SiteConfig } from "@/site-config";
import { logger } from "@/lib/logger";
import { sendEmail } from "@/lib/mail/send-email";
import { WelcomeEmail } from "@/components/emails/welcome-email";

const STATE_COOKIE = "google_oauth_state";
const REFERRAL_COOKIE = SiteConfig.referral.cookieName;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  if (oauthError || !code || !state) {
    return NextResponse.redirect(`${baseUrl}/login`);
  }

  // Verify CSRF state
  const cookieStore = await cookies();
  const storedState = cookieStore.get(STATE_COOKIE)?.value;
  if (!storedState || storedState !== state) {
    logger.error("Google OAuth: state mismatch");
    return NextResponse.redirect(`${baseUrl}/login`);
  }

  // Exchange authorization code for tokens
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    logger.error("Google OAuth: missing client credentials");
    return NextResponse.redirect(`${baseUrl}/login`);
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${baseUrl}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    logger.error("Google token exchange failed:", await tokenRes.text());
    return NextResponse.redirect(`${baseUrl}/login`);
  }

  const tokens = (await tokenRes.json()) as {
    id_token?: string;
    access_token?: string;
  };

  if (!tokens.id_token) {
    logger.error("Google OAuth: no id_token in response");
    return NextResponse.redirect(`${baseUrl}/login`);
  }

  // Create Supabase session from Google ID token
  const supabase = await createClient();
  const { error: authError } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: tokens.id_token,
  });

  if (authError) {
    logger.error("Supabase signInWithIdToken failed:", authError);
    return NextResponse.redirect(`${baseUrl}/login`);
  }

  // Post-login logic (trial + referral + welcome email)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("trial_ends_at, referred_by")
      .eq("id", user.id)
      .single();

    // Set trial for new users
    if (profile?.trial_ends_at === null) {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + SiteConfig.trialDays);
      await supabase
        .from("profiles")
        .update({ trial_ends_at: trialEnd.toISOString() })
        .eq("id", user.id);

      if (user.email) {
        void sendEmail({
          to: user.email,
          subject: "Welcome to BriefTube",
          html: WelcomeEmail({ trialDays: SiteConfig.trialDays }),
        });
      }
    }

    // Record referral if not already set
    if (profile?.referred_by === null) {
      const refCode = cookieStore.get(REFERRAL_COOKIE)?.value;

      if (refCode) {
        const { data: referrer } = await supabase
          .from("profiles")
          .select("id, telegram_chat_id")
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

          if (referrer.telegram_chat_id && process.env.TELEGRAM_BOT_TOKEN) {
            void fetch(
              `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: referrer.telegram_chat_id,
                  text: "Someone just signed up using your BriefTube referral link!",
                }),
              },
            ).catch(() => undefined);
          }
        }
      }
    }
  }

  const response = NextResponse.redirect(`${baseUrl}/dashboard`);
  response.cookies.delete(STATE_COOKIE);
  response.cookies.delete(REFERRAL_COOKIE);
  return response;
}
