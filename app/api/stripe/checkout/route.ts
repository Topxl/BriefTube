import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getOrFindStripeCustomerId } from "@/lib/stripe/helpers";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Read interval, plan, and referral from form body
  const formData = await req.formData().catch(() => null);
  const interval = formData?.get("interval") === "year" ? "year" : "month";
  const plan = formData?.get("plan") || "pro";
  const referral = formData?.get("referral");

  let priceId: string;
  if (plan === "plus") {
    if (!env.STRIPE_PLUS_PRICE_ID) {
      return NextResponse.json(
        { error: "Plus plan not configured" },
        { status: 400 },
      );
    }
    priceId =
      interval === "year" && env.STRIPE_PLUS_ANNUAL_PRICE_ID
        ? env.STRIPE_PLUS_ANNUAL_PRICE_ID
        : env.STRIPE_PLUS_PRICE_ID;
  } else {
    priceId =
      interval === "year"
        ? env.STRIPE_PRO_ANNUAL_PRICE_ID
        : env.STRIPE_PRO_PRICE_ID;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, email, trial_ends_at")
    .eq("id", user.id)
    .single();

  // Get or find Stripe customer
  let customerId = await getOrFindStripeCustomerId(
    supabase,
    user.id,
    user.email ?? profile?.email ?? "",
  );

  // If still no customer, create one
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? profile?.email ?? "",
      metadata: {
        userId: user.id,
      },
    });

    customerId = customer.id;

    await supabase
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  // Carry over remaining trial days
  const trialEndsAt = profile?.trial_ends_at;
  const trialEnd =
    trialEndsAt && new Date(trialEndsAt) > new Date()
      ? Math.floor(new Date(trialEndsAt).getTime() / 1000)
      : undefined;

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    ...(trialEnd ? { subscription_data: { trial_end: trialEnd } } : {}),
    ...(referral ? { client_reference_id: String(referral) } : {}),
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/dashboard/billing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/dashboard/profile`,
    metadata: {
      userId: user.id,
    },
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }

  return NextResponse.redirect(session.url, 303);
}
