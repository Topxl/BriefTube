import { SiteConfig } from "@/site-config";

type PlanProfile = {
  subscription_status: string | null;
  trial_ends_at: string | null;
  max_channels?: number | null;
};

/** Returns true if the user has an active paid plan or a valid trial. */
export function isProUser(profile: PlanProfile): boolean {
  return (
    profile.subscription_status === "active" ||
    (profile.trial_ends_at != null &&
      new Date(profile.trial_ends_at) > new Date())
  );
}

/** Returns the max channels allowed for the user. */
export function getMaxChannels(profile: PlanProfile): number {
  return profile.max_channels ?? SiteConfig.freeChannelsLimit;
}
