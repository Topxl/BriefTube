import crypto from "crypto";
import { SiteConfig } from "@/site-config";

function getSecret(): string {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      "RESEND_WEBHOOK_SECRET is not set — cannot generate or verify unsubscribe tokens",
    );
  }
  return secret;
}

// Generate an HMAC token for a user to unsubscribe
export function generateUnsubscribeUrl(
  userId: string,
  emailType: string,
): string {
  const payload = `${userId}:${emailType}`;
  const token = crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("hex");
  return `${SiteConfig.prodUrl}/api/email/unsubscribe?uid=${userId}&type=${emailType}&token=${token}`;
}

export function verifyUnsubscribeToken(
  userId: string,
  emailType: string,
  token: string,
): boolean {
  const payload = `${userId}:${emailType}`;
  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export function getUnsubscribeHeaders(
  userId: string,
  emailType: string,
): Record<string, string> {
  const url = generateUnsubscribeUrl(userId, emailType);
  return {
    "List-Unsubscribe": `<${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
