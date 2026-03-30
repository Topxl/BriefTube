import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/format";

export type PriceInfo = { amount: number; currency: string };

export type PricesData = {
  monthly: PriceInfo;
  annual: PriceInfo;
  plus?: {
    monthly: PriceInfo;
    annual: PriceInfo | null;
  } | null;
  pro?: {
    monthly: PriceInfo;
    annual: PriceInfo;
  };
};

async function fetchPrices(): Promise<PricesData> {
  const res = await fetch("/api/stripe/price");
  if (!res.ok) throw new Error("Failed to fetch price");
  return res.json() as Promise<PricesData>;
}

// Static fallback so the UI renders instantly without waiting for Stripe API
const FALLBACK_PRICES: PricesData = {
  monthly: { amount: 999, currency: "usd" },
  annual: { amount: 7900, currency: "usd" },
  plus: {
    monthly: { amount: 500, currency: "usd" },
    annual: { amount: 5000, currency: "usd" },
  },
  pro: {
    monthly: { amount: 999, currency: "usd" },
    annual: { amount: 7900, currency: "usd" },
  },
};

export function usePrices() {
  return useQuery({
    queryKey: ["stripe-prices"],
    queryFn: fetchPrices,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
    placeholderData: FALLBACK_PRICES,
  });
}

export function usePriceFormatted() {
  const { data } = usePrices();
  if (!data?.monthly.amount) return null;
  const { formatted, symbol } = formatCurrency(
    data.monthly.amount,
    data.monthly.currency,
  );
  return symbol === "$" ? `${symbol}${formatted}` : `${formatted}${symbol}`;
}
