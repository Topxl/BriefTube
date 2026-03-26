import { describe, it, expect } from "vitest";
import { isProUser, getMaxChannels } from "@/lib/is-pro";

describe("isProUser", () => {
  it("returns true for active subscription", () => {
    expect(
      isProUser({ subscription_status: "active", trial_ends_at: null }),
    ).toBe(true);
  });

  it("returns false for free user", () => {
    expect(
      isProUser({ subscription_status: "free", trial_ends_at: null }),
    ).toBe(false);
  });

  it("returns false for cancelled subscription", () => {
    expect(
      isProUser({ subscription_status: "cancelled", trial_ends_at: null }),
    ).toBe(false);
  });

  it("returns false for past_due subscription", () => {
    expect(
      isProUser({ subscription_status: "past_due", trial_ends_at: null }),
    ).toBe(false);
  });

  it("returns true for valid trial (ends in the future)", () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
    expect(
      isProUser({ subscription_status: "free", trial_ends_at: future }),
    ).toBe(true);
  });

  it("returns false for expired trial", () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
    expect(
      isProUser({ subscription_status: "free", trial_ends_at: past }),
    ).toBe(false);
  });

  it("returns true for active subscription even with expired trial", () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
    expect(
      isProUser({ subscription_status: "active", trial_ends_at: past }),
    ).toBe(true);
  });
});

describe("getMaxChannels", () => {
  it("returns max_channels from profile when set", () => {
    expect(
      getMaxChannels({
        subscription_status: "active",
        trial_ends_at: null,
        max_channels: 20,
      }),
    ).toBe(20);
  });

  it("returns freeChannelsLimit (5) when max_channels is null", () => {
    expect(
      getMaxChannels({
        subscription_status: "free",
        trial_ends_at: null,
        max_channels: null,
      }),
    ).toBe(5);
  });

  it("returns freeChannelsLimit (5) when max_channels is undefined", () => {
    expect(
      getMaxChannels({ subscription_status: "free", trial_ends_at: null }),
    ).toBe(5);
  });
});
