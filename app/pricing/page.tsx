import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "@/lib/icons";
import { SiteConfig } from "@/site-config";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Start free with 3 YouTube channels, or go Pro for unlimited channels, priority processing and custom voices. Simple, transparent pricing.",
  alternates: {
    canonical: `${SiteConfig.prodUrl}/pricing`,
  },
};

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isPro = false;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    isPro = profile?.subscription_status === "active";
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold">Choose Your Plan</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Simple pricing. Upgrade or cancel anytime.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Free Plan */}
        <div className="nm-raised overflow-hidden rounded-2xl">
          <div className="border-b border-white/[0.04] px-5 py-5">
            <p className="text-sm font-semibold tracking-wide uppercase">
              Free
            </p>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl font-bold">$0</span>
              <span className="text-muted-foreground text-sm">/month</span>
            </div>
          </div>
          <div className="px-5 py-4">
            <ul className="space-y-2.5">
              {[
                "5 YouTube channels",
                "AI audio summaries",
                "Telegram delivery",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  {f}
                </li>
              ))}
            </ul>
            {user && !isPro && (
              <Button
                disabled
                className="mt-5 w-full rounded-full"
                variant="outline"
              >
                Current Plan
              </Button>
            )}
            {!user && (
              <Button asChild className="mt-5 w-full rounded-full">
                <a href="/login">Start free trial</a>
              </Button>
            )}
          </div>
        </div>

        {/* Pro Plan */}
        <div className="nm-raised relative overflow-hidden rounded-2xl border border-red-500/[0.12]">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="nm-raised-sm inline-flex items-center rounded-full bg-red-600 px-3 py-0.5 text-xs font-medium text-white shadow-[0_0_12px_rgba(239,68,68,0.3)]">
              Most popular
            </span>
          </div>
          <div className="border-b border-white/[0.04] px-5 pt-7 pb-5">
            <p className="text-sm font-semibold tracking-wide uppercase">Pro</p>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl font-bold">$9</span>
              <span className="text-muted-foreground text-sm">/month</span>
            </div>
          </div>
          <div className="px-5 py-4">
            <ul className="space-y-2.5">
              {[
                "Unlimited channels",
                "Priority processing",
                "Choose your TTS voice",
                "No branding",
                "Early access to features",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  {f}
                </li>
              ))}
            </ul>
            {isPro ? (
              <Button
                disabled
                className="mt-5 w-full rounded-full"
                variant="outline"
              >
                Current Plan
              </Button>
            ) : null}
            {user && !isPro && (
              <form
                action="/api/stripe/checkout"
                method="POST"
                data-form-type="other"
                suppressHydrationWarning
              >
                <Button
                  type="submit"
                  className="mt-5 w-full rounded-full bg-red-600 hover:bg-red-500"
                >
                  Upgrade to Pro
                </Button>
              </form>
            )}
            {!user && (
              <Button
                asChild
                className="mt-5 w-full rounded-full bg-red-600 hover:bg-red-500"
              >
                <a href="/login">Start Pro Trial</a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
