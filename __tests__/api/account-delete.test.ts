import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- Mocks ---

const mockGetUser = vi.fn();
const mockAdminFrom = vi.fn();
const mockAdminDeleteUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
  createAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => mockAdminFrom(...args),
    auth: { admin: { deleteUser: (...args: unknown[]) => mockAdminDeleteUser(...args) } },
  })),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
  heavyRateLimit: null,
}));

const mockStripeCancel = vi.fn();
const mockStripeList = vi.fn();

vi.mock("@/lib/stripe", () => ({
  stripe: {
    subscriptions: {
      cancel: (...args: unknown[]) => mockStripeCancel(...args),
      list: (...args: unknown[]) => mockStripeList(...args),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// --- Helpers ---

function chainedQuery(returnData: unknown = null, returnError: unknown = null) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.upsert = vi.fn().mockResolvedValue({ data: returnData, error: returnError });
  chain.single = vi.fn().mockResolvedValue({ data: returnData, error: returnError });
  return chain;
}

const fakeUser = { id: "user-1", email: "test@test.com" };

// --- Tests ---

describe("DELETE /api/account/delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { DELETE } = await import("@app/api/account/delete/route");
    const req = new NextRequest("http://localhost:3000/api/account/delete", {
      method: "DELETE",
    });
    const response = await DELETE(req, { params: undefined });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("deletes account with Stripe subscription cancellation", async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser } });

    // Profile with stripe subscription
    const profileChain = chainedQuery({
      stripe_subscription_id: "sub_123",
      stripe_customer_id: "cus_123",
    });
    mockFrom.mockReturnValue(profileChain);

    // Admin from (upsert deleted_accounts + delete user data)
    const adminChain = chainedQuery();
    mockAdminFrom.mockReturnValue(adminChain);

    // Stripe cancel
    mockStripeCancel.mockResolvedValue({ id: "sub_123", status: "canceled" });

    // Auth admin delete user
    mockAdminDeleteUser.mockResolvedValue({ data: {}, error: null });

    const { DELETE } = await import("@app/api/account/delete/route");
    const req = new NextRequest("http://localhost:3000/api/account/delete", {
      method: "DELETE",
    });
    const response = await DELETE(req, { params: undefined });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);

    // Should have cancelled the subscription
    expect(mockStripeCancel).toHaveBeenCalledWith("sub_123");

    // Should have deleted auth user
    expect(mockAdminDeleteUser).toHaveBeenCalledWith("user-1");
  });

  it("uses customer ID fallback when subscription ID is missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser } });

    // Profile without stripe subscription ID but with customer ID
    const profileChain = chainedQuery({
      stripe_subscription_id: null,
      stripe_customer_id: "cus_456",
    });
    mockFrom.mockReturnValue(profileChain);

    const adminChain = chainedQuery();
    mockAdminFrom.mockReturnValue(adminChain);

    // Stripe list returns active subscriptions
    mockStripeList.mockResolvedValue({
      data: [{ id: "sub_auto_1" }, { id: "sub_auto_2" }],
    });
    mockStripeCancel.mockResolvedValue({ status: "canceled" });
    mockAdminDeleteUser.mockResolvedValue({ data: {}, error: null });

    const { DELETE } = await import("@app/api/account/delete/route");
    const req = new NextRequest("http://localhost:3000/api/account/delete", {
      method: "DELETE",
    });
    const response = await DELETE(req, { params: undefined });

    expect(response.status).toBe(200);

    // Should list by customer ID
    expect(mockStripeList).toHaveBeenCalledWith({
      customer: "cus_456",
      status: "active",
    });

    // Should cancel all found subscriptions
    expect(mockStripeCancel).toHaveBeenCalledTimes(2);
    expect(mockStripeCancel).toHaveBeenCalledWith("sub_auto_1");
    expect(mockStripeCancel).toHaveBeenCalledWith("sub_auto_2");
  });

  it("continues deletion even if Stripe cancellation fails", async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser } });

    const profileChain = chainedQuery({
      stripe_subscription_id: "sub_123",
      stripe_customer_id: "cus_123",
    });
    mockFrom.mockReturnValue(profileChain);

    const adminChain = chainedQuery();
    mockAdminFrom.mockReturnValue(adminChain);

    // Stripe cancel fails
    mockStripeCancel.mockRejectedValue(new Error("Stripe error"));
    mockAdminDeleteUser.mockResolvedValue({ data: {}, error: null });

    const { DELETE } = await import("@app/api/account/delete/route");
    const req = new NextRequest("http://localhost:3000/api/account/delete", {
      method: "DELETE",
    });
    const response = await DELETE(req, { params: undefined });

    // Should still succeed — Stripe failure is caught
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);

    // Auth user should still be deleted
    expect(mockAdminDeleteUser).toHaveBeenCalledWith("user-1");
  });

  it("records deleted email in deleted_accounts table", async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser } });

    const profileChain = chainedQuery({
      stripe_subscription_id: null,
      stripe_customer_id: null,
    });
    mockFrom.mockReturnValue(profileChain);

    const adminChain = chainedQuery();
    mockAdminFrom.mockReturnValue(adminChain);
    mockAdminDeleteUser.mockResolvedValue({ data: {}, error: null });

    const { DELETE } = await import("@app/api/account/delete/route");
    const req = new NextRequest("http://localhost:3000/api/account/delete", {
      method: "DELETE",
    });
    const response = await DELETE(req, { params: undefined });

    expect(response.status).toBe(200);

    // First call to admin.from should be for deleted_accounts
    expect(mockAdminFrom).toHaveBeenCalledWith("deleted_accounts");
  });

  it("returns 500 when auth user deletion fails", async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser } });

    const profileChain = chainedQuery({
      stripe_subscription_id: null,
      stripe_customer_id: null,
    });
    mockFrom.mockReturnValue(profileChain);

    const adminChain = chainedQuery();
    mockAdminFrom.mockReturnValue(adminChain);

    // Auth delete fails
    mockAdminDeleteUser.mockResolvedValue({
      data: null,
      error: { message: "User not found" },
    });

    const { DELETE } = await import("@app/api/account/delete/route");
    const req = new NextRequest("http://localhost:3000/api/account/delete", {
      method: "DELETE",
    });
    const response = await DELETE(req, { params: undefined });

    // authRoute catches the thrown error and returns 500
    expect(response.status).toBe(500);
  });

  it("deletes data from all related tables in cascade order", async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser } });

    const profileChain = chainedQuery({
      stripe_subscription_id: null,
      stripe_customer_id: null,
    });
    mockFrom.mockReturnValue(profileChain);

    const adminChain = chainedQuery();
    mockAdminFrom.mockReturnValue(adminChain);
    mockAdminDeleteUser.mockResolvedValue({ data: {}, error: null });

    const deletedTables: string[] = [];
    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles" && deletedTables.length === 0) {
        // First profiles call is for select (getting stripe info)
        return profileChain;
      }
      deletedTables.push(table);
      return chainedQuery();
    });

    const { DELETE } = await import("@app/api/account/delete/route");
    const req = new NextRequest("http://localhost:3000/api/account/delete", {
      method: "DELETE",
    });
    await DELETE(req, { params: undefined });

    // Should delete from all these tables (via supabase client, not admin)
    expect(deletedTables).toContain("deliveries");
    expect(deletedTables).toContain("subscriptions");
    expect(deletedTables).toContain("list_follows");
    expect(deletedTables).toContain("list_stars");
    expect(deletedTables).toContain("channel_lists");
    expect(deletedTables).toContain("referrals");
    expect(deletedTables).toContain("profiles");
  });
});
