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

export type LengthPref = "brief" | "standard" | "detailed" | "auto";
export type StylePref = "narrative" | "key_points" | "actionable";

// Keep in sync with worker/gemini_api.py LENGTH_CAPS / LENGTH_TOKEN_CAPS.
const LENGTH_CAPS: Record<Exclude<LengthPref, "auto">, number> = {
  brief: 180,
  standard: 600,
  detailed: 1200,
};

const LENGTH_TOKEN_CAPS: Record<Exclude<LengthPref, "auto">, number> = {
  brief: 500,
  standard: 1300,
  detailed: 2400,
};

const AUTO_RATIO = 0.18;
const AUTO_MIN_WORDS = 150;
const AUTO_MAX_WORDS = 1200;

function computeAutoTargetWords(transcriptWords: number): number {
  return Math.max(
    AUTO_MIN_WORDS,
    Math.min(AUTO_MAX_WORDS, Math.floor(transcriptWords * AUTO_RATIO)),
  );
}

/**
 * Resolve max_output_tokens for a given preference.
 * For 'auto', scales with transcript length; for fixed presets, returns the cap.
 */
export function getMaxTokensForLength(
  lengthPref: LengthPref,
  transcriptWords = 0,
): number {
  if (lengthPref === "auto") {
    const target = computeAutoTargetWords(transcriptWords);
    return Math.floor(target * 2.25);
  }
  return LENGTH_TOKEN_CAPS[lengthPref];
}

// USD per 1M tokens (input, output) for Gemini direct calls — keep in sync
// with worker/gemini_api.py PRICING. Used to compute summary_cost_usd in the
// extension fast-path summarize route for the admin stats dashboard.
export const GEMINI_PRICING: Record<string, { input: number; output: number }> =
  {
    "gemini-2.5-flash": { input: 0.3, output: 2.5 },
    "gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
  };

/** Compute USD cost from input/output tokens for a given Gemini model. */
export function computeGeminiCost(
  modelName: string,
  inputTokens: number,
  outputTokens: number,
): number | null {
  if (!(modelName in GEMINI_PRICING)) return null;
  const pricing = GEMINI_PRICING[modelName];
  return Number(
    (
      (inputTokens / 1_000_000) * pricing.input +
      (outputTokens / 1_000_000) * pricing.output
    ).toFixed(6),
  );
}

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
    lengthPref = "auto",
    stylePref = "narrative",
    customInstructions = "",
  } = params;

  const targetLangName =
    LANGUAGE_NAMES[targetLanguage.toLowerCase()] ?? targetLanguage;
  const transcriptWords = transcript.split(/\s+/).length;
  const audioMaxWords =
    lengthPref === "auto"
      ? computeAutoTargetWords(transcriptWords)
      : LENGTH_CAPS[lengthPref];

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
    `${intro}HARD LENGTH LIMIT: your summary MUST be ${lengthGuidance}. This is a non-negotiable upper bound. Stop writing once you reach ${maxWords} words, even if mid-thought. Brevity is more important than completeness.\n\n` +
    `ABSOLUTE RULE: base yourself ONLY on the provided transcript. Do not use any external knowledge about this video or topic. If the transcript is ambiguous or incomplete, summarize what is present without inventing.\n\n` +
    `Instructions:\n` +
    `1. Summary of ${lengthGuidance} — NEVER exceed ${maxWords} words\n${
      selectivity
    }3. Avoid repetitions and filler. Cut every word that does not add information.\n${styleInstruction(
      stylePref,
    )}5. Output language: ${targetLangName} — mandatory\n`;

  const cleaned = customInstructions.trim().slice(0, 500);
  if (cleaned) {
    prompt += `6. Additional user preferences (apply as best you can without contradicting the rules above): ${cleaned}\n`;
  }

  prompt += `\nTranscript:\n${transcript}\n\nSummary in ${targetLangName} (${lengthGuidance}, hard limit ${maxWords} words):`;
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
