import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock Supabase server client
const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
  }),
}));

// Mock rate-limit to be a no-op (null limiter)
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
  getRequestIp: vi.fn().mockReturnValue("127.0.0.1"),
  authRateLimit: null,
  publicRateLimit: null,
}));

describe("POST /api/lists", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { POST } = await import("@app/api/lists/route");

    const req = new NextRequest("http://localhost:3000/api/lists", {
      method: "POST",
      body: JSON.stringify({ name: "My List" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(req, { params: undefined });
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });
});
