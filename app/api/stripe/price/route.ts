import { NextResponse } from "next/server";
import { connection } from "next/server";
import { getStripe } from "@/lib/stripe";
import { env } from "@/lib/env";

type PriceInfo = {
  amount: number;
  currency: string;
  interval: "month" | "year";
};

type PricesResponse = {
  monthly: PriceInfo;
  annual: PriceInfo;
  plus: {
    monthly: PriceInfo;
    annual: PriceInfo | null;
  } | null;
  pro: {
    monthly: PriceInfo;
    annual: PriceInfo;
  };
};

export async function GET() {
  await connection();
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

  const response: PricesResponse = {
    // Backward compatibility: default to Pro prices
    monthly: {
      amount: proMonthly.unit_amount ?? 0,
      currency: proMonthly.currency,
      interval: "month",
    },
    annual: {
      amount: proAnnual.unit_amount ?? 0,
      currency: proAnnual.currency,
      interval: "year",
    },
    // New structure with explicit plus and pro
    plus: plusMonthly
      ? {
          monthly: {
            amount: plusMonthly.unit_amount ?? 0,
            currency: plusMonthly.currency,
            interval: "month",
          },
          annual: plusAnnual
            ? {
                amount: plusAnnual.unit_amount ?? 0,
                currency: plusAnnual.currency,
                interval: "year",
              }
            : null,
        }
      : null,
    pro: {
      monthly: {
        amount: proMonthly.unit_amount ?? 0,
        currency: proMonthly.currency,
        interval: "month",
      },
      annual: {
        amount: proAnnual.unit_amount ?? 0,
        currency: proAnnual.currency,
        interval: "year",
      },
    },
  };

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
