import { inngest } from "./client";
import { generateAndStoreWeeklyLetter } from "@/lib/letters/generate-letter";
import { sendEmail } from "@/lib/mail/send-email";
import { getAdminEmail } from "@/lib/lea/notifications";
import { logger } from "@/lib/logger";

/**
 * Cron: every Friday 18:00 Europe/Paris (= 17:00 UTC in winter, 16:00 UTC in
 * summer). Generates a draft of the weekly narrative letter and emails Vin so
 * he can review and send it over the weekend.
 *
 * The letter is NEVER auto-sent — Vin always reviews and clicks send.
 */
export const weeklyLetterDraftTrigger = inngest.createFunction(
  {
    id: "weekly-letter-draft-trigger",
    triggers: [{ cron: "TZ=Europe/Paris 0 18 * * 5" }],
  },
  async ({ step }) => {
    const result = await step.run("generate-draft", async () => {
      return generateAndStoreWeeklyLetter({});
    });

    if (!result) {
      logger.error(
        "[weekly-letter] generation failed — all providers down or DB error",
      );
      return { generated: false };
    }

    if (result.was_existing) {
      logger.info("[weekly-letter] draft already existed for this week", {
        id: result.id,
      });
      return { generated: false, reason: "already_exists" };
    }

    // Notify Vin
    await step.run("notify-admin", async () => {
      const adminEmail = await getAdminEmail();
      if (!adminEmail) {
        logger.warn("[weekly-letter] no admin email configured");
        return;
      }
      const link = `https://www.brief-tube.com/dashboard/admin/letters/${result.id}`;
      await sendEmail({
        to: adminEmail,
        subject: `Your weekly letter draft is ready (Episode ${result.episode_number})`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; color: #1f2937;">
            <h2 style="color: #2563eb; margin: 0 0 16px;">Your Episode ${result.episode_number} draft is ready</h2>
            <p style="color: #4b5563;">Léa just wrote this week's narrative letter draft based on the features shipped, the changelog entries, and the running story arc.</p>
            <p style="color: #4b5563;">Review it, edit if needed, then send it (or schedule it) when you feel ready. Best window to send: this weekend.</p>
            <p style="margin: 24px 0 0;">
              <a href="${link}" style="background:#2563eb;color:white;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600;">Open the editor</a>
            </p>
            <p style="margin-top: 24px; color: #6b7280; font-size: 13px;">
              The letter is NEVER auto-sent. You're always the editor in chief.
            </p>
          </div>
        `,
      });
    });

    return {
      generated: true,
      id: result.id,
      episode_number: result.episode_number,
    };
  },
);
