import { z } from "zod";
import { NextResponse } from "next/server";
import { resend } from "@/lib/mail/resend";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const bodySchema = z.object({
  email: z.string().email(),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  if (!env.RESEND_AUDIENCE_ID) {
    logger.warn("RESEND_AUDIENCE_ID is not set — newsletter signup skipped");
    return NextResponse.json({ success: true });
  }

  const { error } = await resend.contacts.create({
    email: parsed.data.email,
    audienceId: env.RESEND_AUDIENCE_ID,
    unsubscribed: false,
  });

  if (error) {
    logger.error("Failed to add newsletter contact:", error);
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 });
  }

  logger.info(`Newsletter signup: ${parsed.data.email}`);
  return NextResponse.json({ success: true });
}
