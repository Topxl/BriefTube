"use client";

import { getPostHogInstance, ensurePostHogInit } from "@/lib/posthog/client";
import { useEffect, useState } from "react";

export function useFeatureFlag(flagKey: string): boolean | string | undefined {
  const [value, setValue] = useState<boolean | string | undefined>(undefined);

  useEffect(() => {
    ensurePostHogInit();
    const posthog = getPostHogInstance();
    if (!posthog) return;

    const v = posthog.getFeatureFlag(flagKey);
    if (v !== undefined) {
      setValue(v);
    }
    const unsubscribe = posthog.onFeatureFlags(() => {
      setValue(posthog.getFeatureFlag(flagKey));
    });
    return unsubscribe;
  }, [flagKey]);

  return value;
}

export function useFeatureFlagEnabled(flagKey: string): boolean {
  const value = useFeatureFlag(flagKey);
  return value === true || value === "true";
}
