import { env } from "@/lib/env";

export type DailyVisitorCount = { date: string; count: number };

async function runHogQLQuery(query: string): Promise<unknown[][] | null> {
  const apiKey = env.POSTHOG_PERSONAL_API_KEY;
  const projectId = env.POSTHOG_PROJECT_ID;

  if (!apiKey || !projectId) return null;

  const host =
    (process.env.NEXT_PUBLIC_POSTHOG_HOST as string | undefined) ??
    "https://us.i.posthog.com";

  try {
    const res = await fetch(`${host}/api/projects/${projectId}/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { results?: unknown[][] };
    return data.results ?? null;
  } catch {
    return null;
  }
}

/** Total unique visitors over the last `days` days. */
export async function getPostHogTotalVisitors(
  days: number,
): Promise<number | null> {
  const results = await runHogQLQuery(
    `SELECT count(DISTINCT distinct_id) FROM events WHERE event = '$pageview' AND timestamp >= now() - interval ${days} day`,
  );
  if (!results) return null;
  return results[0]?.[0] !== undefined ? Number(results[0][0]) : null;
}

/** Daily unique visitor counts for the last `days` days. */
export async function getPostHogDailyVisitors(
  days: number,
): Promise<DailyVisitorCount[] | null> {
  const results = await runHogQLQuery(
    `SELECT toDate(timestamp) as date, count(DISTINCT distinct_id) as visitors FROM events WHERE event = '$pageview' AND timestamp >= now() - interval ${days} day GROUP BY date ORDER BY date ASC`,
  );
  if (!results) return null;
  return results.map((row) => ({
    date: String(row[0]),
    count: Number(row[1]),
  }));
}
