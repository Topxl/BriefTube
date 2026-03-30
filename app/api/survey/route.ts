import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { surveySchema } from "@/lib/survey/survey-schema";
import { restoreSystemPausedChannels } from "@/lib/subscriptions";
import { z } from "zod";

const bodySchema = surveySchema.extend({
  token: z.string().uuid(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { status: "invalid", errors: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { token, q6_freetext, ...answers } = parsed.data;
    const admin = createAdminClient();

    const { data: profile } = await admin
      .from("profiles")
      .select("id, trial_ends_at")
      .eq("id", token)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ status: "invalid_token" }, { status: 404 });
    }

    const { data: existing } = await admin
      .from("survey_responses")
      .select("id")
      .eq("user_id", token)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ status: "already_responded" });
    }

    const insertData = {
      user_id: token,
      q1_pmf: answers.q1_pmf,
      q2_benefit: answers.q2_benefit,
      q3_friction: answers.q3_friction,
      q4_improvement: answers.q4_improvement,
      q5_referral: answers.q5_referral,
      q6_freetext: q6_freetext || null,
    };

    const insertResult = await admin
      .from("survey_responses")
      .insert(insertData as never);

    if (insertResult.error) {
      if (insertResult.error.code === "23505") {
        return NextResponse.json({ status: "already_responded" });
      }
      throw insertResult.error;
    }

    const base =
      profile.trial_ends_at && new Date(profile.trial_ends_at) > new Date()
        ? new Date(profile.trial_ends_at)
        : new Date();
    base.setMonth(base.getMonth() + 1);

    await admin
      .from("profiles")
      .update({
        trial_ends_at: base.toISOString(),
        max_channels: 999,
      } as never)
      .eq("id", token);

    await restoreSystemPausedChannels(token, admin);

    await admin
      .from("survey_responses")
      .update({
        reward_granted: true,
      } as never)
      .eq("user_id", token);

    return NextResponse.json({ status: "success" });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
