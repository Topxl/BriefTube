import { PostHog } from "posthog-node";

type CapturePayload = {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
};

let client: PostHog | null = null;

function getClient(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  if (!client) {
    client = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

export async function captureServerEvent(
  payload: CapturePayload,
): Promise<void> {
  const c = getClient();
  if (!c) return;
  c.capture(payload);
  await c.flush();
}

export async function getFeatureFlag(
  userId: string,
  flagKey: string,
): Promise<boolean | string | undefined> {
  const c = getClient();
  if (!c) return undefined;
  const value = await c.getFeatureFlag(flagKey, userId);
  return value ?? undefined;
}
