import { createClient, createAdminClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { SiteConfig } from "@/site-config";
import { cookies } from "next/headers";
import { sendEmail } from "@/lib/mail/send-email";
import { WelcomeEmail } from "@/components/emails/welcome-email";
import { resend } from "@/lib/mail/resend";
import { env } from "@/lib/env";

const REFERRAL_COOKIE = SiteConfig.referral.cookieName;

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/dashboard";
  const forwardedHost = request.headers.get("x-forwarded-host");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Set trial for new users (profile.trial_ends_at is null on first login)
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Sync Google avatar URL into auth.users metadata if missing
        const meta = user.user_metadata as Record<string, unknown> | undefined;
        if (!meta?.avatar_url && user.identities?.[0]?.identity_data) {
          const googleAvatar = (
            user.identities[0].identity_data as Record<string, unknown>
          ).avatar_url as string | undefined;
          if (googleAvatar) {
            await supabase.auth.updateUser({
              data: { avatar_url: googleAvatar },
            });
          }
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("trial_ends_at, referred_by")
          .eq("id", user.id)
          .single();

        if (profile?.trial_ends_at === null) {
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
              // Send welcome email (fire-and-forget)
              void sendEmail({
                to: user.email,
                subject: "Welcome to BriefTube",
                html: WelcomeEmail({ trialDays: SiteConfig.trialDays }),
              });

              // Add to newsletter audience (fire-and-forget)
              if (env.RESEND_AUDIENCE_ID) {
                void resend.contacts
                  .create({
                    email: user.email,
                    audienceId: env.RESEND_AUDIENCE_ID,
                    unsubscribed: false,
                  })
                  .catch((err) => {
                    logger.error("Failed to add newsletter contact:", err);
                  });
              }
            }
          }
        }

        // Record referral if not already set
        if (profile?.referred_by === null) {
          const cookieStore = await cookies();
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

              // Notify referrer via Telegram (fire-and-forget)
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

      const isLocalEnv = process.env.NODE_ENV === "development";

      let redirectUrl: string;
      if (isLocalEnv) {
        redirectUrl = `${origin}${next}`;
      } else if (forwardedHost) {
        redirectUrl = `https://${forwardedHost}${next}`;
      } else {
        redirectUrl = `${origin}${next}`;
      }

      const response = NextResponse.redirect(redirectUrl);
      // Clear the referral cookie after processing
      response.cookies.delete(REFERRAL_COOKIE);
      return response;
    }
  }

  // Return to login if something went wrong
  return NextResponse.redirect(`${origin}/login`);
}
