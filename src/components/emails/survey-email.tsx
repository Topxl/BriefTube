import { founderEmail, p, signature } from "@/lib/mail/founder-email";

type Props = {
  surveyUrl: string;
  trackingPixelHtml?: string;
};

export function surveyEmailHtml({
  surveyUrl,
  trackingPixelHtml,
}: Props): string {
  const cta = `<p style="margin:24px 0;"><a href="${surveyUrl}" style="display:inline-block;background:#dc2626;color:#ffffff;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;text-decoration:none;">Take the 2-minute survey</a></p>`;

  return founderEmail(
    p("Hey,") +
      p(
        "I'm building BriefTube mostly in the dark — I know you signed up, but I don't really know what you think about it.",
      ) +
      p(
        "I'd love to change that. Answer <strong>6 quick questions</strong> (takes about 2 minutes) and I'll unlock <strong>1 free month of Pro</strong> for your account. No strings attached.",
      ) +
      cta +
      p(
        "Your answers directly shape what I build next. I read every single response.",
      ) +
      signature() +
      (trackingPixelHtml ?? ""),
  );
}
