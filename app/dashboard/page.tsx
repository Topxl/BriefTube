import { SiteConfig } from "@/site-config";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SummariesFeed } from "@/components/dashboard/summaries-feed";
import { SummariesFeedSkeleton } from "@/components/dashboard/summaries-feed-skeleton";
import { TrialBanner } from "@/components/dashboard/trial-banner";
import { SourcesSection } from "@/components/dashboard/sources-section";
import { SectionErrorBoundary } from "@/components/nowts/section-error-boundary";
import { PersonalStats } from "@/components/dashboard/personal-stats";
import { PushNotificationBanner } from "@/components/dashboard/push-notification-banner";
import { GettingStarted } from "@/components/dashboard/getting-started";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: sources }, { data: connections }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "subscription_status, trial_ends_at, max_channels, preferred_language",
        )
        .eq("id", user.id)
        .single(),
      supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .or("source_type.is.null,source_type.eq.youtube_channel")
        .order("created_at", { ascending: false }),
      supabase
        .from("platform_connections")
        .select("platform")
        .eq("user_id", user.id)
        .eq("connected", true),
    ]);

  if (!profile) {
    redirect("/login");
  }

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
    <div className="space-y-6">
      {/* Getting started module */}
      <GettingStarted
        hasChannel={(sources ?? []).length > 0}
        hasConnection={(connections ?? []).length > 0}
        language={profile.preferred_language ?? "fr"}
      />

      {/* Push notification banner */}
      <Suspense fallback={null}>
        <PushNotificationBanner />
      </Suspense>

      {/* Sources */}
      <SectionErrorBoundary>
        <SourcesSection
          initialSources={sources ?? []}
          maxChannels={maxChannels}
          isPro={isPro}
        />
      </SectionErrorBoundary>

      {/* Trial banner */}
      {trialDaysLeft > 0 && <TrialBanner daysLeft={trialDaysLeft} />}

      {/* Personal stats */}
      <SectionErrorBoundary>
        <Suspense fallback={null}>
          <PersonalStats userId={user.id} />
        </Suspense>
      </SectionErrorBoundary>

      {/* Recent summaries */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold">Recent summaries</h2>
        <SectionErrorBoundary>
          <Suspense fallback={<SummariesFeedSkeleton />}>
            <SummariesFeed />
          </Suspense>
        </SectionErrorBoundary>
      </div>
    </div>
  );
}
