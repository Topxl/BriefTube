import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { resend } from "@/lib/mail/resend";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const ADMIN_USER_ID = "67320a39-948c-44d2-98e3-c0de49af1ec6";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id !== ADMIN_USER_ID) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!env.RESEND_AUDIENCE_ID) {
    return NextResponse.json(
      { error: "RESEND_AUDIENCE_ID is not configured" },
      { status: 500 },
    );
  }

  const admin = createAdminClient();

  // Use auth.admin.listUsers to get emails from auth.users (source of truth)
  // profiles.email is often null for older users who signed up before the column was populated
  const { data: authData, error: authError } = await admin.auth.admin.listUsers(
    { page: 1, perPage: 1000 },
  );

  if (authError) {
    logger.error("Failed to fetch auth users for newsletter seed:", authError);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 },
    );
  }

  const audienceId = env.RESEND_AUDIENCE_ID;
  const emails = authData.users
    .map((u) => u.email)
    .filter((e): e is string => !!e);

  // Resend rate limit: 2 req/sec — process one at a time with 600ms gap
  let added = 0;
  let skipped = 0;

  for (let i = 0; i < emails.length; i++) {
    const email = emails[i] as string;

    // eslint-disable-next-line no-await-in-loop
    const { error: contactError } = await resend.contacts.create({
      email,
      audienceId,
      unsubscribed: false,
    });

    if (contactError) {
      logger.warn(`Newsletter seed — skipped ${email}:`, contactError);
      skipped++;
    } else {
      added++;
    }

    // Stay under 2 req/sec (skip delay after last email)
    if (i < emails.length - 1) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
  }

  logger.info(
    `Newsletter seed: ${added} added, ${skipped} skipped out of ${emails.length} users`,
  );
  return NextResponse.json({ total: emails.length, added, skipped });
}
