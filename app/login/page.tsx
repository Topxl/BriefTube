import Link from "next/link";
import Image from "next/image";
import { GoogleLoginButton } from "./_components/google-login-button";
import { EmailMagicLinkForm } from "./_components/email-magic-link-form";
import { t } from "@/locales";
import { SiteConfig } from "@/site-config";
import { createAdminClient } from "@/lib/supabase/server";
import { connection } from "next/server";

const tl = t.auth.login;

function formatCount(n: number): string {
  if (n >= 10000) return `${Math.floor(n / 1000)}k+`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k+`;
  if (n >= 100) return `${Math.floor(n / 10) * 10}+`;
  return `${n}+`;
}

async function fetchStats() {
  try {
    const supabase = createAdminClient();
    const [{ count: summaryCount }, { count: channelCount }] =
      await Promise.all([
        supabase
          .from("processed_videos")
          .select("*", { count: "exact", head: true })
          .eq("status", "completed"),
        supabase
          .from("subscriptions")
          .select("*", { count: "exact", head: true })
          .eq("active", true),
      ]);
    return {
      summaries: summaryCount ?? 0,
      channels: channelCount ?? 0,
    };
  } catch {
    return { summaries: 0, channels: 0 };
  }
}

export default async function LoginPage() {
  await connection();
  const stats = await fetchStats();

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      {/* Background orbs */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 h-[300px] w-[300px] rounded-full bg-red-600/8 blur-[60px]" />
        <div className="absolute right-1/4 bottom-1/4 h-[250px] w-[250px] rounded-full bg-blue-500/8 blur-[60px]" />
      </div>

      <div className="w-full max-w-sm">
        {/* Main login card */}
        <div className="nm-raised overflow-hidden rounded-2xl">
          <div className="flex flex-col items-center px-6 pt-8 pb-2 text-center">
            <Link href="/" className="mb-5">
              <Image src="/logo.svg" alt="BriefTube" width={48} height={48} />
            </Link>
            <p className="text-lg font-semibold">{tl.heading}</p>
            <p className="text-muted-foreground mt-1 text-sm">{tl.subtitle}</p>
          </div>

          {/* Value props */}
          <div className="flex flex-col gap-2 px-6 pt-4 pb-1">
            <div className="flex items-center gap-2.5">
              <svg
                className="h-4 w-4 shrink-0 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <p className="text-muted-foreground text-sm">
                Free for {SiteConfig.freeChannelsLimit} channels, no credit card
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <svg
                className="h-4 w-4 shrink-0 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <p className="text-muted-foreground text-sm">
                {SiteConfig.trialDays}-day Pro trial included
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <svg
                className="h-4 w-4 shrink-0 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <p className="text-muted-foreground text-sm">
                Set up in 2 minutes, summaries start automatically
              </p>
            </div>
          </div>

          <div className="space-y-4 px-6 pt-4 pb-6">
            <p className="text-muted-foreground text-center text-xs">
              {tl.trustLine}
            </p>
            <GoogleLoginButton />
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-white/[0.08]" />
              <span className="text-muted-foreground text-[11px] uppercase tracking-wider">
                {tl.dividerOr}
              </span>
              <div className="h-px flex-1 bg-white/[0.08]" />
            </div>
            <EmailMagicLinkForm />
            <p className="text-muted-foreground text-center text-xs">
              {tl.terms}
            </p>
          </div>
        </div>

        {/* Social proof stats below the card */}
        {(stats.summaries >= 20 || stats.channels >= 10) && (
          <div className="mt-4 flex items-center justify-center gap-6">
            {stats.summaries >= 20 && (
              <div className="text-center">
                <p className="text-foreground text-lg font-bold tabular-nums">
                  {formatCount(stats.summaries)}
                </p>
                <p className="text-muted-foreground text-[11px]">
                  summaries delivered
                </p>
              </div>
            )}
            {stats.summaries >= 20 && stats.channels >= 10 && (
              <div className="h-6 w-px bg-white/[0.08]" />
            )}
            {stats.channels >= 10 && (
              <div className="text-center">
                <p className="text-foreground text-lg font-bold tabular-nums">
                  {formatCount(stats.channels)}
                </p>
                <p className="text-muted-foreground text-[11px]">
                  channels tracked
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
