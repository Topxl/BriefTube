import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { webpush } from "@/lib/web-push";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { z } from "zod";

const bodySchema = z.object({
  userId: z.string().uuid(),
  title: z.string(),
  body: z.string(),
  url: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-push-secret");
  if (!secret || !env.PUSH_NOTIFY_SECRET || secret !== env.PUSH_NOTIFY_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsed;
  try {
    const raw = await req.json();
    parsed = bodySchema.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  // Check if user has push enabled
  const { data: profile } = await supabase
    .from("profiles")
    .select("notify_new_summaries_push")
    .eq("id", parsed.userId)
    .single();

  if (!profile?.notify_new_summaries_push) {
    return NextResponse.json({ skipped: true });
  }

  // Fetch all push subscriptions for this user
  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("endpoint, keys_auth, keys_p256dh")
    .eq("user_id", parsed.userId);

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const payload = JSON.stringify({
    title: parsed.title,
    body: parsed.body,
    url: parsed.url ?? "/dashboard",
  });

  let sent = 0;
  const toDelete: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              auth: sub.keys_auth,
              p256dh: sub.keys_p256dh,
            },
          },
          payload,
        );
        sent++;
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404 or 410 means the subscription is expired/invalid
        if (status === 404 || status === 410) {
          toDelete.push(sub.endpoint);
        } else {
          logger.error("Push send error:", err);
        }
      }
    }),
  );

  // Clean up invalid subscriptions
  if (toDelete.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", toDelete);
  }

  return NextResponse.json({ sent });
}
