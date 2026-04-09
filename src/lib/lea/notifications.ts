import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { sendEmail } from "@/lib/mail/send-email";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Resolve the admin's email by looking up the ADMIN_USER_ID in profiles.
 * Returns null if no admin is configured.
 */
export async function getAdminEmail(): Promise<string | null> {
  if (!env.ADMIN_USER_ID) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("email")
    .eq("id", env.ADMIN_USER_ID)
    .maybeSingle();
  return data?.email ?? null;
}

type EscalationParams = {
  conversationId: string;
  userId: string;
  userMessage: string;
  leaMessage: string;
  reason: string;
  subject: string;
};

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Send an email to the admin when Léa escalates a conversation.
 * Fire-and-forget: errors are logged but never thrown to the caller.
 */
export async function notifyAdminEscalation(
  params: EscalationParams,
): Promise<void> {
  try {
    const adminEmail = await getAdminEmail();
    if (!adminEmail) {
      logger.warn(
        "[lea] notifyAdminEscalation: no admin email configured (ADMIN_USER_ID missing or profile not found)",
      );
      return;
    }

    const admin = createAdminClient();
    const { data: userProfile } = await admin
      .from("profiles")
      .select("email, subscription_status")
      .eq("id", params.userId)
      .maybeSingle();

    const userEmail = userProfile?.email ?? "(unknown)";
    const userPlan = userProfile?.subscription_status ?? "free";
    const link = `https://www.brief-tube.com/dashboard/admin/support/${params.conversationId}`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; color: #1f2937;">
        <h2 style="color: #d97706; margin: 0 0 16px;">New support request</h2>
        <p style="margin: 0 0 8px;"><strong>Subject:</strong> ${escapeHtml(params.subject)}</p>
        <p style="margin: 0 0 8px;"><strong>User:</strong> ${escapeHtml(userEmail)} <span style="color:#6b7280">(${escapeHtml(userPlan)})</span></p>
        <p style="margin: 0 0 16px;"><strong>Escalation reason:</strong> ${escapeHtml(params.reason)}</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;"/>
        <p style="margin: 0 0 4px;"><strong>User message:</strong></p>
        <blockquote style="margin: 0 0 16px; border-left: 3px solid #d1d5db; padding: 8px 12px; color: #4b5563; background: #f9fafb;">${escapeHtml(params.userMessage)}</blockquote>
        <p style="margin: 0 0 4px;"><strong>Léa's reply:</strong></p>
        <blockquote style="margin: 0 0 24px; border-left: 3px solid #d1d5db; padding: 8px 12px; color: #4b5563; background: #f9fafb;">${escapeHtml(params.leaMessage)}</blockquote>
        <p style="margin: 24px 0 0;">
          <a href="${link}" style="background:#2563eb;color:white;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600;">Reply from admin →</a>
        </p>
      </div>
    `;

    await sendEmail({
      to: adminEmail,
      subject: `[Léa] ${params.subject} from ${userEmail}`,
      html,
    });
  } catch (error) {
    logger.error("[lea] notifyAdminEscalation failed", { error });
  }
}

type NewFeatureDetectedParams = {
  featureId: string;
  userId: string;
  title: string;
  description: string;
  category: string;
};

/**
 * Email Vin when Léa auto-creates a new feature from a chat conversation.
 * The feature is in pending-review state and only Vin and the proposer
 * can see it until Vin approves.
 */
export async function notifyAdminNewFeatureDetected(
  params: NewFeatureDetectedParams,
): Promise<void> {
  try {
    const adminEmail = await getAdminEmail();
    if (!adminEmail) return;

    const admin = createAdminClient();
    const { data: userProfile } = await admin
      .from("profiles")
      .select("email, subscription_status")
      .eq("id", params.userId)
      .maybeSingle();

    const userEmail = userProfile?.email ?? "(unknown)";
    const userPlan = userProfile?.subscription_status ?? "free";
    const link = `https://www.brief-tube.com/dashboard/admin/features`;
    const publicLink = `https://www.brief-tube.com/features#${params.featureId}`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; color: #1f2937;">
        <h2 style="color: #2563eb; margin: 0 0 16px;">New feature suggestion (pending review)</h2>
        <p style="margin: 0 0 8px;"><strong>From:</strong> ${escapeHtml(userEmail)} <span style="color:#6b7280">(${escapeHtml(userPlan)})</span></p>
        <p style="margin: 0 0 8px;"><strong>Detected by:</strong> Léa (chat conversation)</p>
        <p style="margin: 0 0 16px;"><strong>Category:</strong> ${escapeHtml(params.category)}</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;"/>
        <h3 style="margin: 0 0 8px;">${escapeHtml(params.title)}</h3>
        <p style="color: #4b5563; margin: 0 0 16px; white-space: pre-wrap;">${escapeHtml(params.description)}</p>
        <p style="color: #6b7280; font-size: 13px; margin: 0 0 24px;">
          This suggestion is currently visible only to you and ${escapeHtml(userEmail)}. Approve it to make it visible on the public roadmap.
        </p>
        <p style="margin: 24px 0 0;">
          <a href="${link}" style="background:#2563eb;color:white;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600;margin-right:8px;">Review in admin →</a>
          <a href="${publicLink}" style="color:#2563eb;text-decoration:none;font-weight:600;">View as user</a>
        </p>
      </div>
    `;

    await sendEmail({
      to: adminEmail,
      subject: `[Léa] New suggestion: ${params.title}`,
      html,
    });
  } catch (error) {
    logger.error("[lea] notifyAdminNewFeatureDetected failed", { error });
  }
}

type FeatureShippedParams = {
  userEmail: string;
  featureTitle: string;
  featureDescription: string;
  featureId: string;
};

/**
 * Email sent to a user whose proposed feature has been shipped.
 */
export async function notifyUserFeatureShipped(
  params: FeatureShippedParams,
): Promise<void> {
  try {
    const link = `https://www.brief-tube.com/features#${params.featureId}`;
    const dashboardLink = `https://www.brief-tube.com/dashboard`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; color: #1f2937;">
        <h2 style="color: #059669; margin: 0 0 16px;">Your suggestion is live!</h2>
        <p>Good news! The feature you suggested has just been shipped:</p>
        <h3 style="margin: 16px 0 8px;">${escapeHtml(params.featureTitle)}</h3>
        <p style="color: #4b5563;">${escapeHtml(params.featureDescription)}</p>
        <p style="margin: 24px 0 0;">
          <a href="${dashboardLink}" style="background:#059669;color:white;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600;margin-right:8px;">Open dashboard →</a>
          <a href="${link}" style="color:#2563eb;text-decoration:none;font-weight:600;">View on roadmap</a>
        </p>
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">Thanks for your contribution. Feedback like yours is what makes BriefTube better.</p>
      </div>
    `;

    await sendEmail({
      to: params.userEmail,
      subject: `Your BriefTube suggestion is live: ${params.featureTitle}`,
      html,
    });
  } catch (error) {
    logger.error("[lea] notifyUserFeatureShipped failed", { error });
  }
}
