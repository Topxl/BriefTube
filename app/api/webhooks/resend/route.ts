import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { checkRateLimit, getRequestIp, publicRateLimit } from "@/lib/rate-limit";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { z } from "zod";

const ResendWebhookSchema = z.object({
  type: z.string(),
  created_at: z.string(),
  data: z.any(),
});

/**
 * Resend webhooks
 *
 * @docs How it work https://resend.com/docs/dashboard/webhooks/introduction
 * @docs Event type https://resend.com/docs/dashboard/webhooks/event-types
 */
export const POST = async (req: NextRequest) => {
  const rateLimitResponse = await checkRateLimit(publicRateLimit, `wh-resend:${getRequestIp(req)}`);
  if (rateLimitResponse) return rateLimitResponse;

  if (!env.RESEND_WEBHOOK_SECRET) {
    logger.error("RESEND_WEBHOOK_SECRET is not configured");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 },
    );
  }

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    logger.error("Missing Svix headers for Resend webhook");
    return NextResponse.json(
      { error: "Missing webhook signature headers" },
      { status: 400 },
    );
  }

  const body = await req.text();

  try {
    const wh = new Webhook(env.RESEND_WEBHOOK_SECRET);
    wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
  } catch (err) {
    logger.error("Resend webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 400 },
    );
  }

  const event = ResendWebhookSchema.parse(JSON.parse(body));

  switch (event.type) {
    case "email.complained":
      logger.warn("Email complained", event.data);
      break;
    case "email.bounced":
      logger.warn("Email bounced", event.data);
      break;
  }

  return NextResponse.json({ ok: true });
};
