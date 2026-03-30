import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import {
  PMF_OPTIONS,
  BENEFIT_OPTIONS,
  IMPROVEMENT_OPTIONS,
  REFERRAL_OPTIONS,
  SIGNUP_REASON_OPTIONS,
  BLOCKER_OPTIONS,
  CONVINCE_OPTIONS,
  DELIVERY_PREF_OPTIONS,
} from "@/lib/survey/survey-schema";

type SurveyResponseRow = {
  id: string;
  user_id: string;
  persona: "active" | "inactive" | null;
  responses: Record<string, unknown> | null;
  q6_freetext: string | null;
  created_at: string;
};

function getVal(r: SurveyResponseRow, field: string) {
  return (r.responses as Record<string, unknown> | null)?.[field];
}

function countField(
  rows: SurveyResponseRow[],
  field: string,
  options: readonly { value: string; label: string }[],
  multi?: boolean,
) {
  const counts: Record<string, number> = {};
  for (const o of options) counts[o.value] = 0;
  for (const r of rows) {
    const val = getVal(r, field);
    if (multi && Array.isArray(val)) {
      for (const v of val as string[]) counts[v] = (counts[v] ?? 0) + 1;
    } else if (typeof val === "string") {
      counts[val] = (counts[val] ?? 0) + 1;
    }
  }
  return counts;
}

function BarChart({
  counts,
  options,
}: {
  counts: Record<string, number>;
  options: readonly { value: string; label: string }[];
}) {
  const max = Math.max(...Object.values(counts), 1);
  return (
    <div className="flex flex-col gap-1.5">
      {options.map((o) => (
        <div key={o.value} className="flex items-center gap-3">
          <div className="w-40 shrink-0 truncate text-xs text-zinc-400">
            {o.label}
          </div>
          <div className="h-4 flex-1 overflow-hidden rounded bg-zinc-800">
            <div
              className="h-full rounded bg-red-600/60"
              style={{ width: `${(counts[o.value] / max) * 100}%` }}
            />
          </div>
          <span className="w-8 text-right text-xs text-zinc-500">
            {counts[o.value]}
          </span>
        </div>
      ))}
    </div>
  );
}

export default async function SurveyResultsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!env.ADMIN_USER_ID || user?.id !== env.ADMIN_USER_ID) {
    redirect("/dashboard");
  }

  const admin = createAdminClient();

  const { data: surveyResponsesRaw, count: surveyCount } = await admin
    .from("survey_responses")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  const surveyResponses =
    (surveyResponsesRaw as unknown as SurveyResponseRow[] | null) ?? [];

  const activeR = surveyResponses.filter((r) => r.persona === "active");
  const inactiveR = surveyResponses.filter((r) => r.persona === "inactive");

  const allFreeText: {
    id: string;
    text: string;
    date: string;
    persona: string;
  }[] = [];
  for (const r of surveyResponses) {
    const resp = r.responses as Record<string, unknown> | null;
    if (!resp) continue;
    const texts: string[] = [];
    if (typeof resp.q5_freetext === "string" && resp.q5_freetext)
      texts.push(resp.q5_freetext);
    for (const key of Object.keys(resp)) {
      if (key.endsWith("_other") && typeof resp[key] === "string" && resp[key])
        texts.push(`[${key}] ${resp[key] as string}`);
    }
    for (const t of texts) {
      allFreeText.push({
        id: `${r.id}-${t.slice(0, 10)}`,
        text: t,
        date: r.created_at,
        persona: r.persona ?? "?",
      });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminBreadcrumb />

      <div>
        <h1 className="text-lg font-semibold">Survey Results</h1>
        <p className="text-muted-foreground text-xs">
          {surveyCount ?? 0} responses — {activeR.length} active ·{" "}
          {inactiveR.length} inactive
        </p>
      </div>

      {surveyResponses.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No survey responses yet.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {/* PMF Score */}
          {activeR.length > 0 &&
            (() => {
              const total = activeR.length;
              const vd = activeR.filter(
                (r) => getVal(r, "q1_pmf") === "very_disappointed",
              ).length;
              const pmfScore = Math.round((vd / total) * 100);
              const color =
                pmfScore >= 40
                  ? "text-emerald-400"
                  : pmfScore >= 20
                    ? "text-yellow-400"
                    : "text-red-400";
              return (
                <div className="rounded-xl border border-white/[0.06] bg-zinc-900 p-5">
                  <p className="text-muted-foreground text-sm">
                    PMF Score (Sean Ellis) — active users
                  </p>
                  <p className={`text-3xl font-bold ${color}`}>{pmfScore}%</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {vd}/{total} "very disappointed" (target: ≥40%)
                  </p>
                </div>
              );
            })()}

          {/* Active user breakdowns */}
          {activeR.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-emerald-400">
                Active Users ({activeR.length})
              </p>
              {(
                [
                  {
                    field: "q1_pmf",
                    title: "How would you feel without BriefTube?",
                    options: PMF_OPTIONS,
                    multi: false,
                  },
                  {
                    field: "q2_benefit",
                    title: "Main benefit",
                    options: BENEFIT_OPTIONS,
                    multi: false,
                  },
                  {
                    field: "q3_improvement",
                    title: "What would help most",
                    options: IMPROVEMENT_OPTIONS,
                    multi: true,
                  },
                  {
                    field: "q4_referral",
                    title: "Who would benefit",
                    options: REFERRAL_OPTIONS,
                    multi: false,
                  },
                ] as const
              ).map(({ field, title, options, multi }) => (
                <div
                  key={field}
                  className="rounded-xl border border-white/[0.06] bg-zinc-900 p-5"
                >
                  <p className="mb-3 text-sm font-medium text-white">{title}</p>
                  <BarChart
                    counts={countField(activeR, field, options, multi)}
                    options={options}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Inactive user breakdowns */}
          {inactiveR.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-yellow-400">
                Inactive Users ({inactiveR.length})
              </p>
              {(
                [
                  {
                    field: "q1_signup_reason",
                    title: "Why did you sign up?",
                    options: SIGNUP_REASON_OPTIONS,
                    multi: false,
                  },
                  {
                    field: "q2_blocker",
                    title: "What stopped you?",
                    options: BLOCKER_OPTIONS,
                    multi: true,
                  },
                  {
                    field: "q3_convince",
                    title: "What would convince you?",
                    options: CONVINCE_OPTIONS,
                    multi: true,
                  },
                  {
                    field: "q4_delivery_pref",
                    title: "Preferred delivery",
                    options: DELIVERY_PREF_OPTIONS,
                    multi: false,
                  },
                ] as const
              ).map(({ field, title, options, multi }) => (
                <div
                  key={field}
                  className="rounded-xl border border-white/[0.06] bg-zinc-900 p-5"
                >
                  <p className="mb-3 text-sm font-medium text-white">{title}</p>
                  <BarChart
                    counts={countField(inactiveR, field, options, multi)}
                    options={options}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Free text */}
          {allFreeText.length > 0 && (
            <div className="rounded-xl border border-white/[0.06] bg-zinc-900 p-5">
              <p className="mb-3 text-sm font-medium text-white">
                Open feedback & comments ({allFreeText.length})
              </p>
              <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
                {allFreeText.map((f) => (
                  <div key={f.id} className="rounded-lg bg-zinc-800 px-3 py-2">
                    <p className="text-sm text-zinc-300">{f.text}</p>
                    <p className="mt-1 text-xs text-zinc-600">
                      {f.persona} · {new Date(f.date).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
