import type { SupabaseClient } from "@supabase/supabase-js";
import { SiteConfig } from "@/site-config";

export type RunResult = {
  sent: number;
  skipped: number;
  errors: number;
};

/**
 * Fetches user IDs that have already received a specific email type
 */
export async function getAlreadySentIds(
  admin: SupabaseClient,
  emailType: string,
  userIds: string[],
): Promise<Set<string>> {
  const { data: logs } = await admin
    .from("email_logs")
    .select("user_id")
    .eq("email_type", emailType)
    .in("user_id", userIds);

  return new Set((logs ?? []).map((l) => l.user_id));
}

/**
 * Inserts an email log entry and returns the log ID
 */
export async function insertEmailLog(
  admin: SupabaseClient,
  userId: string,
  emailType: string,
): Promise<string | null> {
  const { data } = await admin
    .from("email_logs")
    .insert({ user_id: userId, email_type: emailType })
    .select("id")
    .single();

  return data?.id ?? null;
}

/**
 * Returns the HTML for a tracking pixel image tag
 */
export function getTrackingPixelHtml(logId: string | null | undefined): string {
  if (!logId) return "";
  return `<img src="${SiteConfig.prodUrl}/api/email/track/${logId}" width="1" height="1" style="display:none" />`;
}
