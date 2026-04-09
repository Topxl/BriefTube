import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { SurveyForm } from "./survey-form";

export const metadata: Metadata = {
  title: "BriefTube | Quick Feedback Survey",
  robots: "noindex",
};

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ persona?: string }>;
};

export default async function SurveyPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { persona: personaOverride } = await searchParams;

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      token,
    )
  ) {
    notFound();
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("id", token)
    .maybeSingle();

  if (!profile) notFound();

  const { data: existing } = await admin
    .from("survey_responses")
    .select("id")
    .eq("user_id", token)
    .maybeSingle();

  if (existing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold text-white">Thanks!</h1>
          <p className="text-muted-foreground mt-3">
            You already submitted your feedback. Your free month has been
            activated.
          </p>
          <a
            href="/dashboard"
            className="mt-5 inline-block rounded-lg bg-red-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500"
          >
            Go to dashboard
          </a>
        </div>
      </div>
    );
  }

  const { count: deliveryCount } = await admin
    .from("deliveries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", token)
    .eq("status", "sent");

  const detected = (deliveryCount ?? 0) > 0 ? "active" : "inactive";
  const persona =
    personaOverride === "active" || personaOverride === "inactive"
      ? personaOverride
      : detected;

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-12">
      <div className="w-full max-w-lg">
        <SurveyForm token={token} persona={persona} />
      </div>
    </div>
  );
}
