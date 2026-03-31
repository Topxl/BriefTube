import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { SiteConfig } from "@/site-config";
import { logger } from "@/lib/logger";
import { sendEmail } from "@/lib/mail/send-email";
import { WelcomeEmail } from "@/components/emails/welcome-email";
import { getBaseUrl } from "@/lib/server-url";
import { checkRateLimit, getRequestIp, publicRateLimit } from "@/lib/rate-limit";

const STATE_COOKIE = "google_oauth_state";
const REFERRAL_COOKIE = SiteConfig.referral.cookieName;

export async function GET(request: Request) {
  const rateLimitResponse = await checkRateLimit(publicRateLimit, `google-callback:${getRequestIp(request)}`);
  if (rateLimitResponse) return rateLimitResponse;

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const baseUrl = getBaseUrl(request);

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

  let isNewUser = false;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("trial_ends_at, referred_by")
      .eq("id", user.id)
      .single();

    // Set trial for new users (skip if email previously deleted an account)
    if (profile?.trial_ends_at === null) {
      isNewUser = true;
      const admin = createAdminClient();
      let deletedAccount = null;
      if (user.email) {
        const { data } = await admin
          .from("deleted_accounts")
          .select("id")
          .eq("email", user.email)
          .maybeSingle();
        deletedAccount = data;
      }

      if (!deletedAccount) {
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
    }

    // Record referral if not already set
    if (profile?.referred_by === null) {
      const refCode = cookieStore.get(REFERRAL_COOKIE)?.value;

      if (refCode) {
        const admin = createAdminClient();

        const { data: referrer } = await admin
          .from("profiles")
          .select("id, email, telegram_chat_id")
          .eq("referral_code", refCode)
          .single();

        if (referrer && referrer.id !== user.id) {
          await admin
            .from("profiles")
            .update({ referred_by: referrer.id })
            .eq("id", user.id)
            .is("referred_by", null);

          const { error: insertError } = await admin
            .from("referrals")
            .insert({ referrer_id: referrer.id, referee_id: user.id });

          if (insertError && insertError.code !== "23505") {
            logger.error("Failed to insert referral:", insertError);
          } else {
            logger.info("Referral recorded", {
              referrerId: referrer.id,
              refereeId: user.id,
            });
            // Extend trial to 14 days for referred users
            const extendedTrialEnd = new Date();
            extendedTrialEnd.setDate(
              extendedTrialEnd.getDate() +
                SiteConfig.referral.referredTrialDays,
            );
            await supabase
              .from("profiles")
              .update({ trial_ends_at: extendedTrialEnd.toISOString() })
              .eq("id", user.id);
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
          } else if (referrer.email) {
            void sendEmail({
              to: referrer.email,
              subject: "Someone signed up with your BriefTube referral link",
              html: `<p>Hi,</p><p>Someone just signed up using your BriefTube referral link — they now get an extended trial. Thanks for spreading the word!</p><p>— The BriefTube team</p>`,
            }).catch(() => undefined);
          }
        }
      }
    }
  }

  // Redirect new users to profile page to connect delivery channel
  const redirectPath = isNewUser ? "/dashboard/profile" : "/dashboard";
  const response = NextResponse.redirect(`${baseUrl}${redirectPath}`);
  response.cookies.delete(STATE_COOKIE);
  response.cookies.delete(REFERRAL_COOKIE);
  return response;
}
