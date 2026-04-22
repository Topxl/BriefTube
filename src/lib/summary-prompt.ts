/**
 * TypeScript mirror of worker/gemini_api.py `build_summary_prompt`.
 * Used by the Chrome extension's fast path where we have a transcript already
 * and call Gemini directly from Next.js instead of enqueuing to the worker.
 * Keep this in sync with the Python version to guarantee identical output.
 */

const LANGUAGE_NAMES: Record<string, string> = {
  fr: "français",
  en: "English",
  es: "español",
  de: "Deutsch",
  it: "italiano",
  pt: "português",
  nl: "Nederlands",
  pl: "polski",
  ru: "русский",
  ja: "日本語",
  ko: "한국어",
  zh: "中文",
  ar: "العربية",
  hi: "हिन्दी",
  tr: "Türkçe",
};

export type LengthPref = "brief" | "standard" | "detailed";
export type StylePref = "narrative" | "key_points" | "actionable";

const LENGTH_CAPS: Record<LengthPref, number> = {
  brief: 300,
  standard: 800,
  detailed: 1200,
};

function styleInstruction(stylePref: StylePref): string {
  if (stylePref === "key_points") {
    return "4. Structure as a clear list of key points with the main takeaways. Use short, punchy sentences suitable for audio listening.\n";
  }
  if (stylePref === "actionable") {
    return "4. Focus on actionable insights: what can the listener do with this information? Highlight practical advice, tips, and concrete steps. Direct and useful tone.\n";
  }
  return "4. Natural and direct tone, suitable for audio listening.\n";
}

export function buildSummaryPrompt(params: {
  transcript: string;
  sourceLanguage?: string | null;
  targetLanguage?: string;
  lengthPref?: LengthPref;
  stylePref?: StylePref;
  customInstructions?: string;
}): string {
  const {
    transcript,
    sourceLanguage = null,
    targetLanguage = "fr",
    lengthPref = "standard",
    stylePref = "narrative",
    customInstructions = "",
  } = params;

  const targetLangName =
    LANGUAGE_NAMES[targetLanguage.toLowerCase()] ?? targetLanguage;
  const audioMaxWords = LENGTH_CAPS[lengthPref];
  const transcriptWords = transcript.split(/\s+/).length;

  let minWords: number;
  let maxWords: number;
  if (transcriptWords < 150) {
    minWords = Math.max(30, Math.floor(transcriptWords * 0.6));
    maxWords = Math.floor(transcriptWords * 0.9);
  } else if (transcriptWords < 500) {
    minWords = Math.floor(transcriptWords * 0.4);
    maxWords = Math.floor(transcriptWords * 0.7);
  } else {
    minWords = Math.floor(transcriptWords * 0.25);
    maxWords = Math.floor(transcriptWords * 0.5);
  }

  minWords = Math.min(minWords, audioMaxWords);
  maxWords = Math.min(maxWords, audioMaxWords);
  const lengthGuidance = `about ${minWords}-${maxWords} words`;
  const isLongContent = transcriptWords > 4500;

  let intro: string;
  if (sourceLanguage && sourceLanguage !== targetLanguage) {
    const sourceLangName =
      LANGUAGE_NAMES[sourceLanguage.toLowerCase()] ?? sourceLanguage;
    intro = `You are an assistant that summarizes YouTube videos.\nThe transcript below comes from a video in ${sourceLangName}.\nYou must produce the summary in ${targetLangName}.\n\n`;
  } else {
    intro = `You are an assistant that summarizes YouTube videos.\nProduce a summary in ${targetLangName} of the transcript below.\n\n`;
  }

  const selectivity = isLongContent
    ? "2. This transcript is long: be highly selective. Retain only the key insights, important decisions, and main conclusions. Discard digressions, minor anecdotes, ads, and repetitions.\n"
    : "2. Capture the key points and main ideas from the transcript.\n";

  let prompt =
    `${
      intro
    }ABSOLUTE RULE: base yourself ONLY on the provided transcript. Do not use any external knowledge about this video or topic. If the transcript is ambiguous or incomplete, summarize what is present without inventing.\n\n` +
    `Instructions:\n` +
    `1. Summary of ${lengthGuidance} — NEVER exceed this limit\n${
      selectivity
    }3. Avoid repetitions and filler.\n${styleInstruction(
      stylePref,
    )}5. Output language: ${targetLangName} — mandatory\n`;

  const cleaned = customInstructions.trim().slice(0, 500);
  if (cleaned) {
    prompt += `6. Additional user preferences (apply as best you can without contradicting the rules above): ${cleaned}\n`;
  }

  prompt += `\nTranscript:\n${transcript}\n\nSummary in ${targetLangName} (${lengthGuidance}):`;
  return prompt;
}

/**
 * Chaptered structured-output prompt: asks Gemini for JSON with timed chapters.
 * Used for the "Chapters" tab in the extension — a feature Eightify users
 * complain is broken/thematic instead of chronological.
 */
export function buildChaptersPrompt(params: {
  transcript: string;
  videoDurationSec: number;
  targetLanguage?: string;
}): string {
  const { transcript, videoDurationSec, targetLanguage = "fr" } = params;
  const targetLangName =
    LANGUAGE_NAMES[targetLanguage.toLowerCase()] ?? targetLanguage;
  const targetChapters = Math.max(
    3,
    Math.min(12, Math.round(videoDurationSec / 180)),
  );

  return `You are an assistant that extracts chapters from a YouTube video transcript.
Total video duration: ${videoDurationSec} seconds.
Produce ${targetChapters} CHRONOLOGICAL chapters — never reorder, never group by theme.

ABSOLUTE RULES:
- Base yourself ONLY on the transcript. Never invent content.
- Chapters MUST follow chronological order (start times strictly ascending).
- First chapter starts at 0. Last chapter should cover the final section.
- Each chapter title must be a concise, descriptive phrase (4-10 words, no quotes).
- Each chapter summary must be 1-2 sentences in ${targetLangName}.

Output EXACTLY this JSON schema (no markdown, no commentary):
{
  "chapters": [
    { "start_seconds": 0, "title": "...", "summary": "..." },
    { "start_seconds": 123, "title": "...", "summary": "..." }
  ]
}

Transcript (each line is a timestamped caption):
${transcript}

JSON output:`;
}
