import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { getOrFindStripeCustomerId } from "@/lib/stripe/helpers";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const customerId = await getOrFindStripeCustomerId(
    supabase,
    user.id,
    user.email ?? "",
  );

  if (!customerId) {
    return NextResponse.json(
      { error: "No Stripe customer found" },
      { status: 400 },
    );
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/dashboard/profile`,
  });

  return NextResponse.redirect(session.url, 303);
}
