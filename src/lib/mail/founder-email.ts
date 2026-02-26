/**
 * Generates a plain-text-style HTML email from the founder.
 * No design, no buttons, no colors — looks like a real personal email.
 */
export function founderEmail(content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;">
  <div style="max-width:560px;margin:40px auto;padding:0 24px 40px;">
    ${content}
  </div>
</body>
</html>`;
}

export function p(text: string): string {
  return `<p style="margin:0 0 16px;">${text}</p>`;
}

export function signature(name = "Vin"): string {
  return `<p style="margin:24px 0 0;color:#1a1a1a;">${name}<br><span style="color:#6b7280;font-size:13px;">Founder, BriefTube</span></p>`;
}
