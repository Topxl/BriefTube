import Image from "next/image";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { SiteConfig } from "@/site-config";
import { CheckCircle } from "@/lib/icons";

const features = [
  "AI summaries of any YouTube channel delivered to Telegram",
  "Natural audio in your language, listen while multitasking",
  "New videos detected automatically, no manual browsing needed",
];

async function getReferrerName(code: string): Promise<string | null> {
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id, email")
    .eq("referral_code", code)
    .maybeSingle();

  if (!profile) return null;

  // Try to get full name from auth metadata
  const { data: authData } = await admin.auth.admin.getUserById(profile.id);
  const fullName = authData.user?.user_metadata.full_name as string | undefined;

  if (fullName) {
    return fullName.split(" ")[0] ?? fullName;
  }

  // Fallback: extract name from email
  const localPart = profile.email.split("@")[0] ?? "";
  const namePart = localPart.split(/[._-]/)[0] ?? localPart;
  return namePart.charAt(0).toUpperCase() + namePart.slice(1);
}

export default async function ReferralInvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const referrerName = await getReferrerName(code);
  const trialDays = SiteConfig.referral.referredTrialDays;

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      {/* Background orbs */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute top-1/4 left-1/4 h-[400px] w-[400px] rounded-full bg-red-600/8 blur-[180px]"
          style={{ animation: "orb-drift 20s ease-in-out infinite" }}
        />
        <div
          className="absolute right-1/4 bottom-1/3 h-[300px] w-[300px] rounded-full bg-red-500/5 blur-[150px]"
          style={{ animation: "orb-drift 28s ease-in-out infinite reverse" }}
        />
      </div>

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <Link href="/">
            <Image src="/logo.svg" alt="BriefTube" width={48} height={48} />
          </Link>
        </div>

        <div className="nm-raised overflow-hidden rounded-2xl">
          {/* Header */}
          <div className="px-6 pt-6 pb-5">
            {/* Badge */}
            <div className="mb-4 inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1">
              <span className="text-xs font-medium tracking-wide text-red-400 uppercase">
                Exclusive invitation
              </span>
            </div>

            <h1 className="text-xl leading-snug font-semibold">
              You&apos;ve been invited to BriefTube
            </h1>

            {referrerName ? (
              <p className="text-muted-foreground mt-2 text-sm">
                {referrerName} uses BriefTube to stay on top of YouTube without
                watching a single video.
              </p>
            ) : (
              <p className="text-muted-foreground mt-2 text-sm">
                Stay on top of YouTube without watching a single video.
              </p>
            )}
          </div>

          {/* Trial highlight */}
          <div className="border-t border-white/[0.04] bg-red-500/5 px-6 py-4">
            <p className="text-sm font-medium">
              Your free trial:{" "}
              <span className="font-semibold text-red-400">
                {trialDays} days
              </span>{" "}
              <span className="text-muted-foreground text-xs line-through">
                {SiteConfig.trialDays} days
              </span>
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              No credit card required
            </p>
          </div>

          {/* Features */}
          <div className="border-t border-white/[0.04] px-6 py-4">
            <ul className="flex flex-col gap-2.5">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <span className="text-muted-foreground text-sm">{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA */}
          <div className="border-t border-white/[0.04] px-6 py-5">
            <Link
              href={`/r/${code}/accept`}
              className="bg-primary hover:bg-primary/90 flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors"
            >
              Start my {trialDays}-day free trial
            </Link>
            <p className="text-muted-foreground mt-3 text-center text-xs">
              Already have an account?{" "}
              <Link href="/login" className="underline underline-offset-2">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        <p className="text-muted-foreground/50 mt-6 text-center text-xs">
          {SiteConfig.domain}
        </p>
      </div>
    </div>
  );
}
