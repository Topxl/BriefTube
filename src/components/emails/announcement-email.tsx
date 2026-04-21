import { founderEmail, p, signature } from "@/lib/mail/founder-email";

export function AnnouncementEmail(): string {
  return founderEmail(
    `${
      p("Hey,") +
      p(
        "I noticed you created an account on BriefTube but never started a subscription. No judgment, I'm genuinely curious what happened.",
      ) +
      p(
        "Was it the price? The setup friction? Did you try it and it didn't click? Something else entirely?",
      ) +
      p(
        "If you hit reply with one sentence telling me why, I'll send you a free month to try it properly. No strings.",
      ) +
      p("I read every reply myself. Your answer helps me fix what's broken.") +
      signature()
    }<p style="margin:32px 0 0;font-size:12px;color:#999999;"><a href="https://www.brief-tube.com/dashboard/profile" style="color:#999999;">Unsubscribe</a></p>`,
  );
}
