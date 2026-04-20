import { unstable_cache } from "next/cache";
import { getStripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import type { PricesData } from "@/hooks/use-prices";

async function fetchPrices(): Promise<PricesData | null> {
  try {
    const stripe = getStripe();
    const [proMonthly, proAnnual, plusMonthly, plusAnnual] = await Promise.all([
      stripe.prices.retrieve(env.STRIPE_PRO_PRICE_ID),
      stripe.prices.retrieve(env.STRIPE_PRO_ANNUAL_PRICE_ID),
      env.STRIPE_PLUS_PRICE_ID
        ? stripe.prices.retrieve(env.STRIPE_PLUS_PRICE_ID)
        : null,
      env.STRIPE_PLUS_ANNUAL_PRICE_ID
        ? stripe.prices.retrieve(env.STRIPE_PLUS_ANNUAL_PRICE_ID)
        : null,
    ]);
    return {
      monthly: {
        amount: proMonthly.unit_amount ?? 0,
        currency: proMonthly.currency,
      },
      annual: {
        amount: proAnnual.unit_amount ?? 0,
        currency: proAnnual.currency,
      },
      plus: plusMonthly
        ? {
            monthly: {
              amount: plusMonthly.unit_amount ?? 0,
              currency: plusMonthly.currency,
            },
            annual: plusAnnual
              ? {
                  amount: plusAnnual.unit_amount ?? 0,
                  currency: plusAnnual.currency,
                }
              : null,
          }
        : null,
      pro: {
        monthly: {
          amount: proMonthly.unit_amount ?? 0,
          currency: proMonthly.currency,
        },
        annual: {
          amount: proAnnual.unit_amount ?? 0,
          currency: proAnnual.currency,
        },
      },
    };
  } catch {
    return null;
  }
}

export const getCachedPrices = unstable_cache(
  async () => fetchPrices(),
  ["stripe-prices"],
  { revalidate: 300 },
);
