import { render } from "@react-email/render";
import { WeeklyLetterEmail } from "@/components/emails/weekly-letter-email";

/**
 * Minimal server-friendly markdown → HTML converter for the weekly letter.
 * Léa is constrained to write paragraphs + **bold** + *italics* + [links]
 * (no headings, no lists) so this tiny implementation is enough and avoids
 * pulling react-dom/server into our API route bundle.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInline(text: string): string {
  let out = escapeHtml(text);
  // Links: [label](url) — escape url protocol-wise but allow http(s) and mailto and relative
  out = out.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match, label: string, url: string) => {
      const safeUrl =
        /^(https?:|mailto:|\/)/i.exec(url) === null
          ? "#"
          : url.replace(/"/g, "&quot;");
      return `<a href="${safeUrl}" style="color:#a5b4fc;text-decoration:underline;">${label}</a>`;
    },
  );
  // Bold: **text**
  out = out.replace(
    /\*\*([^*]+)\*\*/g,
    '<strong style="color:#ffffff;">$1</strong>',
  );
  // Italics: *text* (single star, but not the bold leftovers)
  out = out.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>");
  return out;
}

function markdownToEmailHtml(markdown: string): string {
  // Split on blank lines into paragraphs
  const paragraphs = markdown
    .trim()
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  return paragraphs
    .map((p) => {
      // Replace single newlines inside a paragraph with <br/>
      const inline = renderInline(p).replace(/\n/g, "<br/>");
      return `<p style="margin:0 0 18px;color:#d4d4d8;font-size:16px;line-height:1.75;">${inline}</p>`;
    })
    .join("\n");
}

/**
 * Render the full weekly letter email as an HTML string ready for Resend.
 */
export async function renderWeeklyLetterHtml(params: {
  episodeNumber: number;
  title: string;
  introNarrativeMarkdown: string;
  unsubscribeUrl: string;
}): Promise<string> {
  const bodyHtml = markdownToEmailHtml(params.introNarrativeMarkdown);
  const preview = params.introNarrativeMarkdown
    .replace(/[#*_`>[\]()~]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);

  return render(
    WeeklyLetterEmail({
      episodeNumber: params.episodeNumber,
      title: params.title,
      preview,
      bodyHtml,
      unsubscribeUrl: params.unsubscribeUrl,
    }),
  );
}
