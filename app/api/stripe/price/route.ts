import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const stripe = getStripe();

  const [monthly, annual] = await Promise.all([
    stripe.prices.retrieve(env.STRIPE_PRO_PRICE_ID),
    stripe.prices.retrieve(env.STRIPE_PRO_ANNUAL_PRICE_ID),
  ]);

  return NextResponse.json({
    monthly: {
      amount: monthly.unit_amount ?? 0,
      currency: monthly.currency,
      interval: "month",
    },
    annual: {
      amount: annual.unit_amount ?? 0,
      currency: annual.currency,
      interval: "year",
    },
  });
}
