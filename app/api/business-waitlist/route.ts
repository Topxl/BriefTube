import { z } from "zod";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  getRequestIp,
  publicRateLimit,
} from "@/lib/rate-limit";

const bodySchema = z.object({
  email: z.string().email().max(200),
  company: z.string().min(1).max(120),
  role: z.string().min(1).max(80),
  teamSize: z.string().max(40).optional().nullable(),
  channels: z.string().min(1).max(2000),
  useCase: z.string().max(2000).optional().nullable(),
});

function parseChannels(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);
}

export async function POST(req: NextRequest) {
  const ip = getRequestIp(req);
  const rateLimited = await checkRateLimit(
    publicRateLimit,
    `business-waitlist:${ip}`,
  );
  if (rateLimited) return rateLimited;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { email, company, role, teamSize, channels, useCase } = parsed.data;
  const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null;

  const supabase = createAdminClient();
  const { error } = await supabase.from("business_waitlist").upsert(
    {
      email: email.toLowerCase(),
      company,
      role,
      team_size: teamSize ?? null,
      channels: parseChannels(channels),
      use_case: useCase ?? null,
      ip,
      user_agent: userAgent,
      source: "/business",
    },
    { onConflict: "email" },
  );

  if (error) {
    logger.error("[business-waitlist] insert failed:", error);
    return NextResponse.json({ error: "Failed to join" }, { status: 500 });
  }

  logger.info(`[business-waitlist] signup: ${email} (${company})`);
  return NextResponse.json({ success: true });
}
