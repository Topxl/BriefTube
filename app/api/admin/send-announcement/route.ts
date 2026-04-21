import { sendEmail } from "@/lib/mail/send-email";
import { AnnouncementEmail } from "@/components/emails/announcement-email";
import { env } from "@/lib/env";
import { getUser } from "@/lib/auth/auth-user";
import { getStripe } from "@/lib/stripe";
import { logger } from "@/lib/logger";
import type { NextRequest } from "next/server";
import type Stripe from "stripe";

const SUBJECT = "quick question about your BriefTube signup";

const UNSUBSCRIBE_HEADERS = {
  "List-Unsubscribe":
    "<https://www.brief-tube.com/dashboard/profile>, <mailto:hello@brief-tube.com?subject=unsubscribe>",
  "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
};

async function fetchStripeNonPayers(): Promise<string[]> {
  const stripe = getStripe();
  const emails: string[] = [];
  const seen = new Set<string>();

  let startingAfter: string | undefined;
  let hasMore = true;

  while (hasMore) {
    // eslint-disable-next-line no-await-in-loop -- cursor-based Stripe pagination is sequential by design
    const page: Stripe.ApiList<Stripe.Customer> = await stripe.customers.list({
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    for (const customer of page.data) {
      const email = customer.email;
      if (!email || seen.has(email)) continue;

      // eslint-disable-next-line no-await-in-loop -- one charge lookup per customer; Stripe rate limits favor sequential
      const charges = await stripe.charges.list({
        customer: customer.id,
        limit: 1,
      });
      const hasPaid = charges.data.some((c) => c.status === "succeeded");
      if (hasPaid) continue;

      seen.add(email);
      emails.push(email);
    }

    hasMore = page.has_more && page.data.length > 0;
    if (hasMore) {
      startingAfter = page.data[page.data.length - 1].id;
    }
  }

  return emails;
}

export const POST = async (req: NextRequest) => {
  const user = await getUser();

  if (!env.ADMIN_USER_ID || user?.id !== env.ADMIN_USER_ID) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  const isTest = req.nextUrl.searchParams.get("test") === "true";

  if (isTest) {
    const adminEmail = user.email;
    if (!adminEmail) {
      return new Response(JSON.stringify({ error: "Admin email not found" }), {
        status: 500,
      });
    }

    const result = await sendEmail({
      to: adminEmail,
      subject: `[TEST] ${SUBJECT}`,
      html: AnnouncementEmail(),
      headers: UNSUBSCRIBE_HEADERS,
    });

    return new Response(
      JSON.stringify({
        sent: result.error ? 0 : 1,
        failed: result.error ? 1 : 0,
        total: 1,
      }),
      { status: 200 },
    );
  }

  let recipients: string[];
  try {
    recipients = await fetchStripeNonPayers();
  } catch (err) {
    logger.error("[send-announcement] Failed to fetch Stripe customers", {
      err,
    });
    return new Response(
      JSON.stringify({ error: "Failed to fetch Stripe customers" }),
      { status: 500 },
    );
  }

  if (recipients.length === 0) {
    return new Response(JSON.stringify({ sent: 0, failed: 0, total: 0 }), {
      status: 200,
    });
  }

  let sent = 0;
  let failed = 0;

  for (const email of recipients) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 600));

    // eslint-disable-next-line no-await-in-loop
    const result = await sendEmail({
      to: email,
      subject: SUBJECT,
      html: AnnouncementEmail(),
      headers: UNSUBSCRIBE_HEADERS,
    });

    if (result.error) {
      failed++;
    } else {
      sent++;
    }
  }

  return new Response(
    JSON.stringify({
      sent,
      failed,
      total: recipients.length,
    }),
    { status: 200 },
  );
};
