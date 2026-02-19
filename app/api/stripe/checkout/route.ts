import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, email, trial_ends_at")
    .eq("id", user.id)
    .single();

  // Create or get Stripe customer
  let customerId = profile?.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? profile?.email ?? "",
      metadata: {
        userId: user.id,
      },
    });

    customerId = customer.id;

    // Save customer ID
    await supabase
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  // Carry over remaining trial days so the user doesn't lose them
  const trialEndsAt = profile?.trial_ends_at;
  const trialEnd =
    trialEndsAt && new Date(trialEndsAt) > new Date()
      ? Math.floor(new Date(trialEndsAt).getTime() / 1000)
      : undefined;

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: env.STRIPE_PRO_PRICE_ID,
        quantity: 1,
      },
    ],
    ...(trialEnd ? { subscription_data: { trial_end: trialEnd } } : {}),
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
