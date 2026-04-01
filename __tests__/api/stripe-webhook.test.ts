import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- Mocks ---

const mockFrom = vi.fn();
const mockSupabaseAdmin = {
  from: mockFrom,
  auth: { admin: { deleteUser: vi.fn() } },
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn() },
  }),
  createAdminClient: vi.fn(() => mockSupabaseAdmin),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
  getRequestIp: vi.fn().mockReturnValue("127.0.0.1"),
  publicRateLimit: null,
}));

const mockConstructEvent = vi.fn();
const mockRetrieve = vi.fn();

vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: { constructEvent: (...args: unknown[]) => mockConstructEvent(...args) },
    subscriptions: { retrieve: (...args: unknown[]) => mockRetrieve(...args) },
    customers: {
      create: vi.fn().mockResolvedValue({ id: "cus_new" }),
      createBalanceTransaction: vi.fn(),
    },
  },
}));

vi.mock("@/lib/env", () => ({
  env: {
    STRIPE_WEBHOOK_SECRET: "whsec_test",
    STRIPE_SECRET_KEY: "sk_test_123",
    STRIPE_PRO_PRICE_ID: "price_pro",
    STRIPE_PRO_ANNUAL_PRICE_ID: "price_pro_annual",
  },
}));

vi.mock("@/lib/stripe/helpers", () => ({
  updateSubscriptionStatus: vi.fn(),
}));

vi.mock("@/lib/subscriptions", () => ({
  restoreSystemPausedChannels: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/lib/mail/send-email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/components/emails/upgrade-email", () => ({
  UpgradeEmail: vi.fn().mockReturnValue("<html>Upgrade</html>"),
}));

vi.mock("@/components/emails/payment-failed-email", () => ({
  PaymentFailedEmail: vi.fn().mockReturnValue("<html>Failed</html>"),
}));

vi.mock("@/lib/posthog/server", () => ({
  captureServerEvent: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({
    get: (name: string) => {
      if (name === "stripe-signature") return "sig_test_123";
      return null;
    },
  }),
}));

vi.mock("@/site-config", () => ({
  SiteConfig: {
    freeChannelsLimit: 5,
    plusChannelsLimit: 50,
    referral: {
      monthlyRewardFraction: 0.2,
      annualRewardMonths: 1,
      currency: "usd",
    },
  },
}));

// --- Helpers ---

function makeWebhookRequest(body = "{}") {
  return new NextRequest("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    body,
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": "sig_test_123",
    },
  });
}

function chainedQuery(returnData: unknown = null, returnError: unknown = null) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.upsert = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data: returnData, error: returnError });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: returnData, error: returnError });
  return chain;
}

// --- Tests ---

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when stripe-signature header is missing", async () => {
    // Override headers mock for this test
    const { headers } = await import("next/headers");
    vi.mocked(headers).mockResolvedValueOnce({
      get: () => null,
    } as unknown as Awaited<ReturnType<typeof headers>>);

    const { POST } = await import("@app/api/webhooks/stripe/route");
    const req = makeWebhookRequest();
    const response = await POST(req);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Missing Stripe signature");
  });

  it("returns 400 when signature verification fails", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const { POST } = await import("@app/api/webhooks/stripe/route");
    const req = makeWebhookRequest("raw_body");
    const response = await POST(req);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid Stripe webhook signature");
  });

  it("returns 200 for unhandled event types", async () => {
    mockConstructEvent.mockReturnValue({
      type: "some.unknown.event",
      data: { object: {} },
    });

    const { POST } = await import("@app/api/webhooks/stripe/route");
    const req = makeWebhookRequest();
    const response = await POST(req);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
  });

  describe("checkout.session.completed", () => {
    it("activates subscription and sends upgrade email", async () => {
      const profileChain = chainedQuery({ id: "user-1", email: "test@test.com", stripe_customer_id: "cus_123", referred_by: null });
      const updateChain = chainedQuery();

      mockFrom.mockImplementation((table: string) => {
        if (table === "profiles") return profileChain;
        return updateChain;
      });

      mockConstructEvent.mockReturnValue({
        type: "checkout.session.completed",
        data: {
          object: {
            customer: "cus_123",
            subscription: "sub_123",
            metadata: { userId: "user-1" },
            amount_total: 1000,
          },
        },
      });

      mockRetrieve.mockResolvedValue({
        status: "active",
        items: { data: [{ plan: { interval: "month" } }] },
      });

      const { POST } = await import("@app/api/webhooks/stripe/route");
      const req = makeWebhookRequest();
      const response = await POST(req);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);

      const { updateSubscriptionStatus } = await import("@/lib/stripe/helpers");
      expect(updateSubscriptionStatus).toHaveBeenCalledWith(
        mockSupabaseAdmin,
        "user-1",
        "active",
        true,
      );

      const { sendEmail } = await import("@/lib/mail/send-email");
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "test@test.com",
          subject: "Your BriefTube Pro subscription is active",
        }),
      );
    });

    it("returns early when customer or subscription is missing", async () => {
      mockConstructEvent.mockReturnValue({
        type: "checkout.session.completed",
        data: {
          object: {
            customer: null,
            subscription: null,
          },
        },
      });

      const { POST } = await import("@app/api/webhooks/stripe/route");
      const req = makeWebhookRequest();
      const response = await POST(req);

      expect(response.status).toBe(200);
      // updateSubscriptionStatus should not have been called
      const { updateSubscriptionStatus } = await import("@/lib/stripe/helpers");
      expect(updateSubscriptionStatus).not.toHaveBeenCalled();
    });

    it("falls back to metadata.userId when customer ID lookup fails", async () => {
      // First call (by customer ID) returns null, second (by userId) returns profile
      const callCount = { n: 0 };
      const profileChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: vi.fn().mockImplementation(async () => {
          callCount.n++;
          if (callCount.n === 1) {
            return Promise.resolve({ data: null, error: null });
          }
          return Promise.resolve({
            data: { id: "user-2", email: "u2@test.com", stripe_customer_id: null, referred_by: null },
            error: null,
          });
        }),
      };

      mockFrom.mockReturnValue(profileChain);

      mockConstructEvent.mockReturnValue({
        type: "checkout.session.completed",
        data: {
          object: {
            customer: "cus_unknown",
            subscription: "sub_456",
            metadata: { userId: "user-2" },
            amount_total: 500,
          },
        },
      });

      mockRetrieve.mockResolvedValue({
        status: "active",
        items: { data: [{ plan: { interval: "month" } }] },
      });

      const { POST } = await import("@app/api/webhooks/stripe/route");
      const req = makeWebhookRequest();
      const response = await POST(req);

      expect(response.status).toBe(200);
    });
  });

  describe("customer.subscription.updated", () => {
    it("updates subscription status for active subscription", async () => {
      const profileChain = chainedQuery({ id: "user-1" });
      mockFrom.mockReturnValue(profileChain);

      mockConstructEvent.mockReturnValue({
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_123",
            customer: "cus_123",
            status: "active",
          },
        },
      });

      const { POST } = await import("@app/api/webhooks/stripe/route");
      const req = makeWebhookRequest();
      const response = await POST(req);

      expect(response.status).toBe(200);

      const { updateSubscriptionStatus } = await import("@/lib/stripe/helpers");
      expect(updateSubscriptionStatus).toHaveBeenCalledWith(
        mockSupabaseAdmin,
        "user-1",
        "active",
        true,
      );

      const { restoreSystemPausedChannels } = await import("@/lib/subscriptions");
      expect(restoreSystemPausedChannels).toHaveBeenCalledWith("user-1", mockSupabaseAdmin);
    });

    it("does not restore channels when subscription is not active", async () => {
      const profileChain = chainedQuery({ id: "user-1" });
      mockFrom.mockReturnValue(profileChain);

      mockConstructEvent.mockReturnValue({
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_123",
            customer: "cus_123",
            status: "past_due",
          },
        },
      });

      const { POST } = await import("@app/api/webhooks/stripe/route");
      const req = makeWebhookRequest();
      const response = await POST(req);

      expect(response.status).toBe(200);

      const { restoreSystemPausedChannels } = await import("@/lib/subscriptions");
      expect(restoreSystemPausedChannels).not.toHaveBeenCalled();
    });

    it("returns early when user profile not found", async () => {
      const profileChain = chainedQuery(null);
      profileChain.single = vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } });
      mockFrom.mockReturnValue(profileChain);

      mockConstructEvent.mockReturnValue({
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_123",
            customer: "cus_unknown",
            status: "active",
          },
        },
      });

      const { POST } = await import("@app/api/webhooks/stripe/route");
      const req = makeWebhookRequest();
      const response = await POST(req);

      expect(response.status).toBe(200);

      const { updateSubscriptionStatus } = await import("@/lib/stripe/helpers");
      expect(updateSubscriptionStatus).not.toHaveBeenCalled();
    });
  });

  describe("customer.subscription.deleted", () => {
    it("reverts user to free plan and clears subscription ID", async () => {
      const profileChain = chainedQuery({ id: "user-1" });
      mockFrom.mockReturnValue(profileChain);

      mockConstructEvent.mockReturnValue({
        type: "customer.subscription.deleted",
        data: {
          object: {
            id: "sub_123",
            customer: "cus_123",
            status: "canceled",
          },
        },
      });

      const { POST } = await import("@app/api/webhooks/stripe/route");
      const req = makeWebhookRequest();
      const response = await POST(req);

      expect(response.status).toBe(200);

      const { updateSubscriptionStatus } = await import("@/lib/stripe/helpers");
      expect(updateSubscriptionStatus).toHaveBeenCalledWith(
        mockSupabaseAdmin,
        "user-1",
        "free",
        false,
      );
    });
  });

  describe("invoice.payment_failed", () => {
    it("sends payment failed email to user", async () => {
      const profileChain = chainedQuery({ id: "user-1", email: "user@test.com" });
      mockFrom.mockReturnValue(profileChain);

      mockConstructEvent.mockReturnValue({
        type: "invoice.payment_failed",
        data: {
          object: {
            customer: "cus_123",
          },
        },
      });

      const { POST } = await import("@app/api/webhooks/stripe/route");
      const req = makeWebhookRequest();
      const response = await POST(req);

      expect(response.status).toBe(200);

      const { sendEmail } = await import("@/lib/mail/send-email");
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@test.com",
          subject: "Your BriefTube payment failed",
        }),
      );
    });

    it("returns early when customer is missing", async () => {
      mockConstructEvent.mockReturnValue({
        type: "invoice.payment_failed",
        data: {
          object: {
            customer: null,
          },
        },
      });

      const { POST } = await import("@app/api/webhooks/stripe/route");
      const req = makeWebhookRequest();
      const response = await POST(req);

      expect(response.status).toBe(200);

      const { sendEmail } = await import("@/lib/mail/send-email");
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("returns early when user profile not found", async () => {
      const profileChain = chainedQuery(null);
      profileChain.single = vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } });
      mockFrom.mockReturnValue(profileChain);

      mockConstructEvent.mockReturnValue({
        type: "invoice.payment_failed",
        data: {
          object: {
            customer: "cus_unknown",
          },
        },
      });

      const { POST } = await import("@app/api/webhooks/stripe/route");
      const req = makeWebhookRequest();
      const response = await POST(req);

      expect(response.status).toBe(200);

      const { sendEmail } = await import("@/lib/mail/send-email");
      expect(sendEmail).not.toHaveBeenCalled();
    });
  });

  it("returns 500 when event handler throws", async () => {
    const profileChain = chainedQuery({ id: "user-1" });
    profileChain.single = vi.fn().mockRejectedValue(new Error("DB down"));
    mockFrom.mockReturnValue(profileChain);

    mockConstructEvent.mockReturnValue({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_123",
          customer: "cus_123",
          status: "active",
        },
      },
    });

    const { POST } = await import("@app/api/webhooks/stripe/route");
    const req = makeWebhookRequest();
    const response = await POST(req);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Webhook handler failed");
    expect(body.eventType).toBe("customer.subscription.updated");
  });
});
