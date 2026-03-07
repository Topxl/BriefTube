import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/format";

type PricesData = {
  monthly: { amount: number; currency: string };
  annual: { amount: number; currency: string };
};

async function fetchPrices(): Promise<PricesData> {
  const res = await fetch("/api/stripe/price");
  if (!res.ok) throw new Error("Failed to fetch price");
  return res.json() as Promise<PricesData>;
}

export function usePrices() {
  return useQuery({
    queryKey: ["stripe-prices"],
    queryFn: fetchPrices,
    staleTime: 1000 * 60 * 60, // 1h — prices rarely change
    gcTime: 1000 * 60 * 60 * 24,
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
