import crypto from "crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import {
  checkRateLimit,
  getRequestIp,
  publicRateLimit,
} from "@/lib/rate-limit";

/**
 * Validates the `Authorization: Bearer <CRON_SECRET>` header on cron routes.
 *
 * Uses crypto.timingSafeEqual so an attacker can't leak the secret one byte
 * at a time by measuring response latency. Also rate-limits by IP as a defense-in-depth
 * measure. Returns a 401 NextResponse when the header is missing or doesn't match,
 * or a 429 if rate-limited, otherwise null (continue).
 */
export async function checkCronAuth(
  req: NextRequest,
): Promise<NextResponse | null> {
  const rl = await checkRateLimit(publicRateLimit, `cron:${getRequestIp(req)}`);
  if (rl) return rl;

  const secret = env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;

  const a = Buffer.from(authHeader);
  const b = Buffer.from(expected);

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
