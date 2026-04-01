import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- Mocks ---

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
  createAdminClient: vi.fn(() => ({
    from: vi.fn().mockReturnValue({
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
  })),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
  getRequestIp: vi.fn().mockReturnValue("127.0.0.1"),
  authRateLimit: null,
  heavyRateLimit: null,
}));

vi.mock("@/lib/youtube", () => ({
  getYouTubeChannelInfo: vi.fn().mockResolvedValue({
    channelId: "UCxxxxxxxxxxxxxxxxxxxxxx",
    channelName: "Test Channel",
    channelAvatarUrl: "https://example.com/avatar.jpg",
  }),
  fetchVideoOembed: vi.fn(),
}));

vi.mock("@/lib/youtube-id", () => ({
  extractVideoId: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/subscriptions", () => ({
  getUserPlan: vi.fn().mockResolvedValue({ isPro: false, maxChannels: 5 }),
  restoreSystemPausedChannels: vi.fn(),
}));

vi.mock("@/lib/video-queue", () => ({
  queueVideoForProcessing: vi.fn().mockResolvedValue({ queued: true }),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock global fetch for RSS
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// --- Helpers ---

function chainedQuery(returnData: unknown = null, returnError: unknown = null) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.upsert = vi.fn().mockResolvedValue({ data: returnData, error: returnError });
  chain.single = vi.fn().mockResolvedValue({ data: returnData, error: returnError });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: returnData, error: returnError });
  return chain;
}

const fakeUser = { id: "user-1", email: "test@test.com" };

// --- Tests ---

describe("GET /api/subscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { GET } = await import("@app/api/subscriptions/route");
    const response = await GET();

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns user subscriptions", async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser } });

    const subscriptions = [
      { id: "sub-1", channel_name: "Channel A", active: true },
      { id: "sub-2", channel_name: "Channel B", active: false },
    ];
    // GET calls .from().select().eq().order() — order() returns the final { data, error }
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: subscriptions, error: null }),
    };
    mockFrom.mockReturnValue(chain);

    const { GET } = await import("@app/api/subscriptions/route");
    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(subscriptions);
  });

  it("returns 500 on database error", async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser } });

    const chain = chainedQuery(null, { message: "DB error" });
    // For GET, the code does not call .single() — it just uses the result of order()
    // We need to make the chain return error at the end
    chain.order = vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } });
    mockFrom.mockReturnValue(chain);

    const { GET } = await import("@app/api/subscriptions/route");
    const response = await GET();

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("DB error");
  });
});

describe("POST /api/subscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: RSS feed returns no videos
    mockFetch.mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue("<feed></feed>"),
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { POST } = await import("@app/api/subscriptions/route");
    const req = new NextRequest("http://localhost:3000/api/subscriptions", {
      method: "POST",
      body: JSON.stringify({ channelId: "test", channelName: "Test" }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(req);

    expect(response.status).toBe(401);
  });

  it("returns 400 when body is invalid JSON", async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser } });

    const { POST } = await import("@app/api/subscriptions/route");
    const req = new NextRequest("http://localhost:3000/api/subscriptions", {
      method: "POST",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(req);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid JSON");
  });

  it("returns 400 when neither url nor channelId is provided", async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser } });

    const { POST } = await import("@app/api/subscriptions/route");
    const req = new NextRequest("http://localhost:3000/api/subscriptions", {
      method: "POST",
      body: JSON.stringify({ channelName: "test" }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(req);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("channelId and channelName are required");
  });

  it("returns 422 when channel ID is not a valid YouTube channel ID", async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser } });

    // Make YouTube lookup return an invalid channel ID
    const { getYouTubeChannelInfo } = await import("@/lib/youtube");
    vi.mocked(getYouTubeChannelInfo).mockResolvedValueOnce({
      channelId: "not-a-valid-id",
      channelName: "Test",
      channelAvatarUrl: null as unknown as string,
    });

    // Profile chain
    const profileChain = chainedQuery({ preferred_language: "fr" });
    // Count chain
    const countChain = chainedQuery();
    (countChain as Record<string, unknown>).select = vi.fn().mockReturnValue({
      ...countChain,
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: 0 }),
      }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") return profileChain;
      return countChain;
    });

    const { POST } = await import("@app/api/subscriptions/route");
    const req = new NextRequest("http://localhost:3000/api/subscriptions", {
      method: "POST",
      body: JSON.stringify({ channelId: "@badchannel", channelName: "Bad" }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(req);

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error).toContain("Could not find a valid YouTube channel");
  });

  it("returns 409 when already subscribed to channel", async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser } });

    const { getYouTubeChannelInfo } = await import("@/lib/youtube");
    vi.mocked(getYouTubeChannelInfo).mockResolvedValueOnce({
      channelId: "UCxxxxxxxxxxxxxxxxxxxxxx",
      channelName: "Test Channel",
      channelAvatarUrl: "https://example.com/avatar.jpg",
    });

    const profileChain = chainedQuery({ preferred_language: "fr" });
    const countChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count: 2 }),
        }),
      }),
    };
    const existingChain = chainedQuery({ id: "existing-sub" });

    let fromCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") return profileChain;
      if (table === "subscriptions") {
        fromCallCount++;
        // First call is for plan check, second is for count, third is for existing check
        if (fromCallCount <= 1) return countChain;
        return existingChain;
      }
      return chainedQuery();
    });

    const { getUserPlan } = await import("@/lib/subscriptions");
    vi.mocked(getUserPlan).mockResolvedValueOnce({ isPro: false, maxChannels: 5 });

    const { POST } = await import("@app/api/subscriptions/route");
    const req = new NextRequest("http://localhost:3000/api/subscriptions", {
      method: "POST",
      body: JSON.stringify({ channelId: "@testchannel", channelName: "Test Channel" }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(req);

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toBe("Already subscribed to this channel");
  });

  it("returns 201 when subscription is created successfully", async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser } });

    const { getYouTubeChannelInfo } = await import("@/lib/youtube");
    vi.mocked(getYouTubeChannelInfo).mockResolvedValueOnce({
      channelId: "UCxxxxxxxxxxxxxxxxxxxxxx",
      channelName: "Test Channel",
      channelAvatarUrl: "https://example.com/avatar.jpg",
    });

    const { getUserPlan } = await import("@/lib/subscriptions");
    vi.mocked(getUserPlan).mockResolvedValueOnce({ isPro: true, maxChannels: 999 });

    const profileChain = chainedQuery({ preferred_language: "en" });
    const countChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count: 0 }),
        }),
      }),
    };
    // "existing" check returns null
    const existingChain = chainedQuery(null);
    existingChain.single = vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } });

    const insertedSub = { id: "new-sub-1", channel_name: "Test Channel", active: true };
    const insertChain = chainedQuery();
    insertChain.insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: insertedSub, error: null }),
      }),
    });

    // The RSS upsert chain
    const upsertChain = chainedQuery();

    let subFromCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") return profileChain;
      if (table === "processed_videos") return upsertChain;
      if (table === "subscriptions") {
        subFromCallCount++;
        if (subFromCallCount === 1) return countChain;
        if (subFromCallCount === 2) return existingChain;
        return insertChain;
      }
      return chainedQuery();
    });

    const { POST } = await import("@app/api/subscriptions/route");
    const req = new NextRequest("http://localhost:3000/api/subscriptions", {
      method: "POST",
      body: JSON.stringify({ channelId: "@testchannel", channelName: "Test Channel" }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(req);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.id).toBe("new-sub-1");
  });
});

describe("DELETE /api/subscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { DELETE } = await import("@app/api/subscriptions/route");
    const req = new NextRequest("http://localhost:3000/api/subscriptions?id=sub-1", {
      method: "DELETE",
    });
    const response = await DELETE(req);

    expect(response.status).toBe(401);
  });

  it("returns 400 when subscription ID is missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser } });

    const { DELETE } = await import("@app/api/subscriptions/route");
    const req = new NextRequest("http://localhost:3000/api/subscriptions", {
      method: "DELETE",
    });
    const response = await DELETE(req);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Subscription ID required");
  });

  it("deletes subscription successfully", async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser } });

    const chain = chainedQuery();
    chain.delete = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    mockFrom.mockReturnValue(chain);

    const { DELETE } = await import("@app/api/subscriptions/route");
    const req = new NextRequest("http://localhost:3000/api/subscriptions?id=sub-1", {
      method: "DELETE",
    });
    const response = await DELETE(req);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  it("returns 500 on database error", async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser } });

    const chain = chainedQuery();
    chain.delete = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: "FK violation" } }),
      }),
    });
    mockFrom.mockReturnValue(chain);

    const { DELETE } = await import("@app/api/subscriptions/route");
    const req = new NextRequest("http://localhost:3000/api/subscriptions?id=sub-1", {
      method: "DELETE",
    });
    const response = await DELETE(req);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("FK violation");
  });
});
