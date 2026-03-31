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
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
  authRateLimit: null,
}));

const mockCheckoutCreate = vi.fn();
const mockCustomersCreate = vi.fn();
const mockCustomersList = vi.fn();

vi.mock("@/lib/stripe", () => ({
  stripe: {
    checkout: {
      sessions: {
        create: (...args: unknown[]) => mockCheckoutCreate(...args),
      },
    },
    customers: {
      create: (...args: unknown[]) => mockCustomersCreate(...args),
      list: (...args: unknown[]) => mockCustomersList(...args),
    },
  },
}));

vi.mock("@/lib/stripe/helpers", () => ({
  getOrFindStripeCustomerId: vi.fn().mockResolvedValue("cus_existing"),
}));

vi.mock("@/lib/env", () => ({
  env: {
    STRIPE_SECRET_KEY: "sk_test_123",
    STRIPE_PRO_PRICE_ID: "price_pro_monthly",
    STRIPE_PRO_ANNUAL_PRICE_ID: "price_pro_annual",
    STRIPE_PLUS_PRICE_ID: "price_plus_monthly",
    STRIPE_PLUS_ANNUAL_PRICE_ID: "price_plus_annual",
    STRIPE_WEBHOOK_SECRET: "whsec_test",
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
  chain.update = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data: returnData, error: returnError });
  return chain;
}

const fakeUser = { id: "user-1", email: "test@test.com" };

function makeCheckoutRequest(formFields: Record<string, string> = {}) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(formFields)) {
    formData.set(key, value);
  }
  return new NextRequest("http://localhost:3000/api/stripe/checkout", {
    method: "POST",
    body: formData,
  });
}

// --- Tests ---

describe("POST /api/stripe/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { POST } = await import("@app/api/stripe/checkout/route");
    const req = makeCheckoutRequest();
    const response = await POST(req);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("creates checkout session with monthly pro plan by default", async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser } });

    const profileChain = chainedQuery({
      stripe_customer_id: "cus_existing",
      email: "test@test.com",
      trial_ends_at: null,
    });
    mockFrom.mockReturnValue(profileChain);

    mockCheckoutCreate.mockResolvedValue({
      url: "https://checkout.stripe.com/session_123",
    });

    const { POST } = await import("@app/api/stripe/checkout/route");
    const req = makeCheckoutRequest();
    const response = await POST(req);

    // Should redirect (303)
    expect(response.status).toBe(303);

    // Verify the checkout session was created with monthly pro price
    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_existing",
        mode: "subscription",
        line_items: [{ price: "price_pro_monthly", quantity: 1 }],
        metadata: { userId: "user-1" },
      }),
    );
  });

  it("creates checkout session with annual pro plan", async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser } });

    const profileChain = chainedQuery({
      stripe_customer_id: "cus_existing",
      email: "test@test.com",
      trial_ends_at: null,
    });
    mockFrom.mockReturnValue(profileChain);

    mockCheckoutCreate.mockResolvedValue({
      url: "https://checkout.stripe.com/session_123",
    });

    const { POST } = await import("@app/api/stripe/checkout/route");
    const req = makeCheckoutRequest({ interval: "year" });
    const response = await POST(req);

    expect(response.status).toBe(303);
    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: "price_pro_annual", quantity: 1 }],
      }),
    );
  });

  it("creates checkout session with plus plan", async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser } });

    const profileChain = chainedQuery({
      stripe_customer_id: "cus_existing",
      email: "test@test.com",
      trial_ends_at: null,
    });
    mockFrom.mockReturnValue(profileChain);

    mockCheckoutCreate.mockResolvedValue({
      url: "https://checkout.stripe.com/session_123",
    });

    const { POST } = await import("@app/api/stripe/checkout/route");
    const req = makeCheckoutRequest({ plan: "plus" });
    const response = await POST(req);

    expect(response.status).toBe(303);
    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: "price_plus_monthly", quantity: 1 }],
      }),
    );
  });

  it("creates checkout session with annual plus plan", async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser } });

    const profileChain = chainedQuery({
      stripe_customer_id: "cus_existing",
      email: "test@test.com",
      trial_ends_at: null,
    });
    mockFrom.mockReturnValue(profileChain);

    mockCheckoutCreate.mockResolvedValue({
      url: "https://checkout.stripe.com/session_123",
    });

    const { POST } = await import("@app/api/stripe/checkout/route");
    const req = makeCheckoutRequest({ plan: "plus", interval: "year" });
    const response = await POST(req);

    expect(response.status).toBe(303);
    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: "price_plus_annual", quantity: 1 }],
      }),
    );
  });

  it("creates a new Stripe customer when none exists", async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser } });

    const { getOrFindStripeCustomerId } = await import("@/lib/stripe/helpers");
    vi.mocked(getOrFindStripeCustomerId).mockResolvedValueOnce(null);

    const profileChain = chainedQuery({
      stripe_customer_id: null,
      email: "test@test.com",
      trial_ends_at: null,
    });
    mockFrom.mockReturnValue(profileChain);

    mockCustomersCreate.mockResolvedValue({ id: "cus_new_123" });

    mockCheckoutCreate.mockResolvedValue({
      url: "https://checkout.stripe.com/session_new",
    });

    const { POST } = await import("@app/api/stripe/checkout/route");
    const req = makeCheckoutRequest();
    const response = await POST(req);

    expect(response.status).toBe(303);

    // Should have created a new customer
    expect(mockCustomersCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "test@test.com",
        metadata: { userId: "user-1" },
      }),
    );

    // Should use the new customer ID in checkout
    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_new_123",
      }),
    );
  });

  it("returns 500 when checkout session URL is null", async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser } });

    const profileChain = chainedQuery({
      stripe_customer_id: "cus_existing",
      email: "test@test.com",
      trial_ends_at: null,
    });
    mockFrom.mockReturnValue(profileChain);

    mockCheckoutCreate.mockResolvedValue({ url: null });

    const { POST } = await import("@app/api/stripe/checkout/route");
    const req = makeCheckoutRequest();
    const response = await POST(req);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Failed to create checkout session");
  });

  it("carries over trial_end when user has active trial", async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser } });

    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const profileChain = chainedQuery({
      stripe_customer_id: "cus_existing",
      email: "test@test.com",
      trial_ends_at: futureDate,
    });
    mockFrom.mockReturnValue(profileChain);

    mockCheckoutCreate.mockResolvedValue({
      url: "https://checkout.stripe.com/session_trial",
    });

    const { POST } = await import("@app/api/stripe/checkout/route");
    const req = makeCheckoutRequest();
    const response = await POST(req);

    expect(response.status).toBe(303);
    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_data: {
          trial_end: expect.any(Number),
        },
      }),
    );
  });

  it("does not set trial_end when trial has expired", async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser } });

    const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const profileChain = chainedQuery({
      stripe_customer_id: "cus_existing",
      email: "test@test.com",
      trial_ends_at: pastDate,
    });
    mockFrom.mockReturnValue(profileChain);

    mockCheckoutCreate.mockResolvedValue({
      url: "https://checkout.stripe.com/session_notrial",
    });

    const { POST } = await import("@app/api/stripe/checkout/route");
    const req = makeCheckoutRequest();
    const response = await POST(req);

    expect(response.status).toBe(303);

    // Should NOT have subscription_data.trial_end
    const createCall = mockCheckoutCreate.mock.calls[0][0];
    expect(createCall.subscription_data).toBeUndefined();
  });

  it("passes referral as client_reference_id when provided", async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser } });

    const profileChain = chainedQuery({
      stripe_customer_id: "cus_existing",
      email: "test@test.com",
      trial_ends_at: null,
    });
    mockFrom.mockReturnValue(profileChain);

    mockCheckoutCreate.mockResolvedValue({
      url: "https://checkout.stripe.com/session_ref",
    });

    const { POST } = await import("@app/api/stripe/checkout/route");
    const req = makeCheckoutRequest({ referral: "ref_abc123" });
    const response = await POST(req);

    expect(response.status).toBe(303);
    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        client_reference_id: "ref_abc123",
      }),
    );
  });
});
