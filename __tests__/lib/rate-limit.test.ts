import { describe, it, expect, vi } from "vitest";

// Mock @upstash/ratelimit and @upstash/redis before importing the module
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: vi.fn(),
}));

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn(),
}));

// Import the functions we want to test directly (they don't depend on Redis init)
import { getRequestIp, checkRateLimit } from "@/lib/rate-limit";

describe("getRequestIp", () => {
  it("returns x-real-ip when present", () => {
    const req = new Request("https://example.com", {
      headers: { "x-real-ip": "1.2.3.4" },
    });
    expect(getRequestIp(req)).toBe("1.2.3.4");
  });

  it("returns first x-forwarded-for IP when x-real-ip is absent", () => {
    const req = new Request("https://example.com", {
      headers: { "x-forwarded-for": "10.0.0.1, 10.0.0.2, 10.0.0.3" },
    });
    expect(getRequestIp(req)).toBe("10.0.0.1");
  });

  it("prefers x-real-ip over x-forwarded-for", () => {
    const req = new Request("https://example.com", {
      headers: {
        "x-real-ip": "1.2.3.4",
        "x-forwarded-for": "10.0.0.1",
      },
    });
    expect(getRequestIp(req)).toBe("1.2.3.4");
  });

  it("returns 'unknown' when no IP headers are present", () => {
    const req = new Request("https://example.com");
    expect(getRequestIp(req)).toBe("unknown");
  });

  it("trims whitespace from x-forwarded-for", () => {
    const req = new Request("https://example.com", {
      headers: { "x-forwarded-for": "  5.6.7.8 , 9.10.11.12" },
    });
    expect(getRequestIp(req)).toBe("5.6.7.8");
  });
});

describe("checkRateLimit", () => {
  it("returns null when limiter is null (no Redis configured)", async () => {
    const result = await checkRateLimit(null, "test-id");
    expect(result).toBeNull();
  });

  it("returns null when rate limit is not exceeded", async () => {
    const mockLimiter = {
      limit: vi.fn().mockResolvedValue({
        success: true,
        limit: 30,
        remaining: 29,
        reset: Date.now() + 60000,
      }),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await checkRateLimit(mockLimiter as any, "user-123");
    expect(result).toBeNull();
    expect(mockLimiter.limit).toHaveBeenCalledWith("user-123");
  });

  it("returns 429 response when rate limit is exceeded", async () => {
    const resetTime = Date.now() + 60000;
    const mockLimiter = {
      limit: vi.fn().mockResolvedValue({
        success: false,
        limit: 30,
        remaining: 0,
        reset: resetTime,
      }),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await checkRateLimit(mockLimiter as any, "user-123");

    expect(result).not.toBeNull();
    expect(result?.status).toBe(429);

    const body = await result?.json();
    expect(body.error).toBe("Too many requests");
  });

  it("includes rate limit headers in 429 response", async () => {
    const resetTime = Date.now() + 30000;
    const mockLimiter = {
      limit: vi.fn().mockResolvedValue({
        success: false,
        limit: 3,
        remaining: 0,
        reset: resetTime,
      }),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await checkRateLimit(mockLimiter as any, "ip:1.2.3.4");

    expect(result?.headers.get("X-RateLimit-Limit")).toBe("3");
    expect(result?.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(result?.headers.get("X-RateLimit-Reset")).toBe(resetTime.toString());
    expect(result?.headers.get("Retry-After")).toBeTruthy();
  });
});
