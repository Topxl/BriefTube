import { z } from "zod";
import { NextResponse } from "next/server";
import { resend } from "@/lib/mail/resend";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { NextRequest } from "next/server";

const bodySchema = z.object({
  email: z.string().email(),
});

// Simple in-memory rate limit: 3 signups per IP per 10 min (best-effort on serverless)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 10 * 60 * 1000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;
  return false;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ??
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  if (!env.RESEND_AUDIENCE_ID) {
    logger.warn("RESEND_AUDIENCE_ID is not set — newsletter signup skipped");
    return NextResponse.json({ success: true });
  }

  const { error } = await resend.contacts.create({
    email: parsed.data.email,
    audienceId: env.RESEND_AUDIENCE_ID,
    unsubscribed: false,
  });

  if (error) {
    logger.error("Failed to add newsletter contact:", error);
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 });
  }

  logger.info(`Newsletter signup: ${parsed.data.email}`);
  return NextResponse.json({ success: true });
}
