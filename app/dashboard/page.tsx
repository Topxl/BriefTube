import { SiteConfig } from "@/site-config";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SummariesFeed } from "@/components/dashboard/summaries-feed";
import { TrialBanner } from "@/components/dashboard/trial-banner";
import { SourcesSection } from "@/components/dashboard/sources-section";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "onboarding_completed, subscription_status, trial_ends_at, max_channels",
    )
    .eq("id", user.id)
    .single();

  // Redirect new users to onboarding
  if (!profile?.onboarding_completed) {
    redirect("/onboarding");
  }

  // Personal subscriptions only — exclude ghost subs from list follows
  const { data: sources } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .or("source_type.is.null,source_type.eq.youtube_channel")
    .order("created_at", { ascending: false });

  const isPro =
    profile.subscription_status === "active" ||
    (profile.trial_ends_at != null &&
      new Date(profile.trial_ends_at) > new Date());
  const maxChannels = profile.max_channels ?? SiteConfig.freeChannelsLimit;

  // Trial logic — Server Component, Date.now() is safe here (not a client hook)
  const trialEndsAt = profile.trial_ends_at ?? null;
  const nowMs = Date.now(); // eslint-disable-line react-hooks/purity
  const trialDaysLeft = trialEndsAt
    ? Math.ceil((new Date(trialEndsAt).getTime() - nowMs) / 86400000)
    : 0;

  return (
    <div className="space-y-8">
      {/* Trial banner */}
      {trialDaysLeft > 0 && <TrialBanner daysLeft={trialDaysLeft} />}

      {/* Sources */}
      <SourcesSection
        initialSources={sources ?? []}
        maxChannels={maxChannels}
        isPro={isPro}
      />

      {/* Recent summaries */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Recent summaries</h2>
        <Suspense fallback={null}>
          <SummariesFeed />
        </Suspense>
      </div>
    </div>
  );
}
