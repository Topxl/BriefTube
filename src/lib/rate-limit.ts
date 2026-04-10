import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

// Create Redis client — fallback to no-op if not configured
let redis: Redis | undefined;

try {
  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
} catch {
  console.warn("Redis not configured for rate limiting");
}

// Reusable rate limiters

/** Public (unauthenticated) endpoints: 3 requests per 10 minutes per IP */
export const publicRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, "10 m"),
      prefix: "rl:public",
    })
  : null;

/** OAuth / login flow: 10 requests per 10 minutes per IP — generous enough for normal login retries */
export const loginRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "10 m"),
      prefix: "rl:login",
    })
  : null;

/** Authenticated endpoints: 30 requests per minute per user */
export const authRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "1 m"),
      prefix: "rl:auth",
    })
  : null;

/** Heavy endpoints (AI processing): 5 requests per minute per user */
export const heavyRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "1 m"),
      prefix: "rl:heavy",
    })
  : null;

/** Extract client IP from request headers */
export function getRequestIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const real = req.headers.get("x-real-ip");
  return real ?? forwarded?.split(",")[0]?.trim() ?? "unknown";
}

/** Check rate limit and return a 429 response if exceeded, or null if OK */
export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string,
): Promise<NextResponse | null> {
  // Bypass rate limiting in tests (E2E + unit) — explicit opt-out
  if (process.env.DISABLE_RATE_LIMIT === "true") return null;
  if (!limiter) return null; // No Redis configured — skip rate limiting

  const { success, limit, remaining, reset } = await limiter.limit(identifier);

  if (!success) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
          "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString(),
        },
      },
    );
  }

  return null;
}
