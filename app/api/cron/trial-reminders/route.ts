import { env } from "@/lib/env";
import { runTrialReminders } from "@/lib/cron/trial-reminders";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const maxDuration = 300;

export const GET = async (req: NextRequest) => {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${env.CRON_SECRET}`;

  if (!env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runTrialReminders();

  return NextResponse.json({ ok: true, result });
};
