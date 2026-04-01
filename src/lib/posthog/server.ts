import { PostHog } from "posthog-node";
import { after } from "next/server";

type CapturePayload = {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
};

async function sendEvent(payload: CapturePayload): Promise<void> {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  const client = new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });

  client.capture(payload);
  await client.shutdown();
}

export function captureServerEvent(payload: CapturePayload): void {
  after(async () => sendEvent(payload));
}

function getPostHogServer(): PostHog {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_POSTHOG_KEY is not set");

  return new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });
}

export async function getFeatureFlag(
  userId: string,
  flagKey: string,
): Promise<boolean | string | undefined> {
  const posthog = getPostHogServer();
  try {
    const value = await posthog.getFeatureFlag(flagKey, userId);
    return value ?? undefined;
  } finally {
    await posthog.shutdown();
  }
}
