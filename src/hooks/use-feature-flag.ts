"use client";

import { usePostHog } from "posthog-js/react";
import { useEffect, useState } from "react";

export function useFeatureFlag(
  flagKey: string,
): boolean | string | undefined {
  const posthog = usePostHog();
  const [value, setValue] = useState<boolean | string | undefined>(undefined);

  useEffect(() => {
    // Get the flag value (might already be loaded)
    const v = posthog.getFeatureFlag(flagKey);
    if (v !== undefined) {
      setValue(v);
    }
    // Listen for flag changes
    const unsubscribe = posthog.onFeatureFlags(() => {
      setValue(posthog.getFeatureFlag(flagKey));
    });
    return unsubscribe;
  }, [posthog, flagKey]);

  return value;
}

export function useFeatureFlagEnabled(flagKey: string): boolean {
  const value = useFeatureFlag(flagKey);
  return value === true || value === "true";
}
