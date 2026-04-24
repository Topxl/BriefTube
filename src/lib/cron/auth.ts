import crypto from "crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";

/**
 * Validates the `Authorization: Bearer <CRON_SECRET>` header on cron routes.
 *
 * Uses crypto.timingSafeEqual so an attacker can't leak the secret one byte
 * at a time by measuring response latency. Returns a 401 NextResponse when
 * the header is missing or doesn't match, otherwise null (continue).
 */
export function checkCronAuth(req: NextRequest): NextResponse | null {
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
