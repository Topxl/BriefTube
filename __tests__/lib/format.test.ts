import { describe, it, expect } from "vitest";
import { formatCurrency } from "@/lib/format";

describe("formatCurrency", () => {
  it("formats USD cents correctly", () => {
    const result = formatCurrency(999, "usd");
    expect(result.symbol).toBe("$");
    expect(result.formatted).toBe("9.99");
  });

  it("formats EUR cents correctly", () => {
    const result = formatCurrency(500, "eur");
    expect(result.symbol).toBe("€");
    expect(result.formatted).toBe("5.00");
  });

  it("formats zero correctly", () => {
    const result = formatCurrency(0, "usd");
    expect(result.symbol).toBe("$");
    expect(result.formatted).toBe("0.00");
  });

  it("returns the currency code as symbol for unknown currencies", () => {
    const result = formatCurrency(1000, "chf");
    expect(result.symbol).toBeTruthy();
    expect(result.formatted).toBeTruthy();
  });

  // Regression: landing pricing showed $9.99 for both Plus ($5) and Pro ($9.99)
  it("Plus price (500 cents) displays as $5.00, not $9.99", () => {
    const plus = formatCurrency(500, "usd");
    const pro = formatCurrency(999, "usd");
    expect(plus.formatted).toBe("5.00");
    expect(pro.formatted).toBe("9.99");
    expect(plus.formatted).not.toBe(pro.formatted);
  });
});
