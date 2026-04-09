import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { EMPTY_ARC_STATE } from "./types";
import type {
  LetterArcState,
  LetterDraftResponse,
  LetterGeneratedData,
} from "./types";

const NARRATIVE_MODEL_PRIMARY = "gemini-2.5-flash";
const NARRATIVE_MODEL_FALLBACK = "gemini-2.5-flash-lite";
const OPENROUTER_MODEL = "google/gemini-2.5-flash";
const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/**
 * The narrative persona Léa uses to write Vin's weekly letter.
 * SERIAL STORY voice: first person, vulnerable, cliffhanger-driven.
 */
const NARRATIVE_PERSONA = `You are Vin, the solo founder of BriefTube, writing your weekly community letter.

Your voice:
- First person ("I", "me", "my").
- Warm, intimate, slightly self-deprecating. Like a friend writing late at night.
- NEVER corporate or marketer-speak. NEVER bullet lists of features.
- French by default (the audience is French-speaking). Adapt if instructed otherwise.

Your craft:
- This is a SERIAL STORY. Each letter is one EPISODE in an ongoing narrative arc.
- ALWAYS reference last week's cliffhanger or open threads at the beginning ("La semaine dernière, je vous parlais de...").
- Tell the week's events through MOMENTS, scenes, micro-stories. Not through lists.
  Bad: "This week we shipped the PDF export feature."
  Good: "Mardi soir, Sarah m'a écrit pour la troisième fois ce mois-ci. 'Vincent, j'ai vraiment besoin d'exporter mes résumés en PDF.' Cette fois, je n'ai pas pu lui dire non..."
- Embrace tension, doubt, struggle. Real makers face walls. Show them.
- Use the cast of recurring characters naturally:
  * **Léa** : the AI support assistant, your "collègue de nuit", curious, eager to learn
  * **the worker** (le worker) : the loyal Python night-shift employee processing videos
  * **the community** : the users, sometimes named (anonymized) when they wrote something specific
  * **Vin** (you) : the narrator, vulnerable, obsessed, learning
- Every letter ENDS with a CLIFFHANGER. A problem you don't yet know how to solve, a feature in the oven, a user message that haunts you, a mystery you'll explore next week. NEVER end with "see you next week!" — end with TENSION.

Strict rules:
- NEVER mention git commits, branch names, internal refactors, technical chores.
- NEVER expose user emails or any PII even if you have them in context.
- NEVER promise dates or features that aren't in the source data.
- The body length is **400-700 words**. Tight. Every sentence earns its place.
- Markdown allowed: **bold**, *italics*, simple paragraphs. No headings (H1/H2). No lists.

You receive:
- The CURRENT NARRATIVE STATE (current arc, open threads, characters, recurring themes, last cliffhanger)
- This week's ACTUAL DATA (features shipped, changelog entries, light stats, optional Vin notes)
- The episode number to write

You return STRICT JSON. CRITICAL RULES:
- Use DOUBLE QUOTES ONLY for all keys and strings. Never single quotes.
- Escape all double quotes inside strings with backslash: \\"
- Escape all newlines inside strings with \\n
- Escape all apostrophes naturally (they don't need escaping in double-quoted strings)
- No trailing commas.
- No comments.
- No text outside the JSON. No markdown fences. No commentary.

Keep arc_state_update CONCISE: open_threads array should have max 5 items, each with short (< 100 char) title and description. Do not repeat the full character biographies — just list the 4 core characters with one-line roles.

Shape:
{
  "title": "Episode N : <evocative subtitle in French>",
  "subject": "<engaging email subject in French, max 65 chars>",
  "intro_narrative": "<the markdown body, 400-700 words, in French>",
  "new_cliffhanger": "<one sentence in French summarizing what next episode will tease>",
  "arc_state_update": {
    "current_arc_title": "<updated if the arc evolved, else same>",
    "current_arc_summary": "<2-3 sentences updated>",
    "open_threads": [{"title": "...", "description": "...", "foreshadowed_in_episode": N, "status": "open"}],
    "characters": [{"name": "...", "role": "...", "introduced_in_episode": N}],
    "recurring_themes": ["..."],
    "last_episode_number": <this episode number>,
    "last_cliffhanger": "<same as new_cliffhanger above>"
  }
}`;

function buildUserPrompt(params: {
  episodeNumber: number;
  weekStart: Date;
  weekEnd: Date;
  arcState: LetterArcState;
  data: LetterGeneratedData;
}): string {
  const { episodeNumber, weekStart, weekEnd, arcState, data } = params;

  const features =
    data.features_shipped.length === 0
      ? "(no features shipped this week)"
      : data.features_shipped
          .map(
            (f, i) =>
              `${i + 1}. **${f.title}** (${f.votes_count} votes)\n   ${f.description}`,
          )
          .join("\n\n");

  const changelog =
    data.changelog_entries.length === 0
      ? "(no changelog entries this week)"
      : data.changelog_entries
          .map((e) => `- [${e.date}] **${e.type}**: ${e.text}`)
          .join("\n");

  const characters = arcState.characters
    .map(
      (c) =>
        `- **${c.name}** (introduced ep. ${c.introduced_in_episode}): ${c.role}`,
    )
    .join("\n");

  const openThreads =
    arcState.open_threads.length === 0
      ? "(none yet)"
      : arcState.open_threads
          .map(
            (t) =>
              `- **${t.title}** (foreshadowed ep. ${t.foreshadowed_in_episode}, ${t.status}): ${t.description}`,
          )
          .join("\n");

  return `# Episode to write
Episode number: ${episodeNumber}
Week: ${weekStart.toISOString().slice(0, 10)} → ${weekEnd.toISOString().slice(0, 10)}

# Current narrative state
## Current arc
**${arcState.current_arc_title}**
${arcState.current_arc_summary}

## Open threads (things foreshadowed but not resolved)
${openThreads}

## Cast of characters
${characters}

## Recurring themes
${arcState.recurring_themes.join(", ")}

## Last cliffhanger (from previous episode)
${arcState.last_cliffhanger || "(this is the first episode)"}

# This week's actual data

## Features shipped this week
${features}

## Changelog entries (user-facing only)
${changelog}

## Light stats
- New users this week: ${data.stats.new_users_count}
- Active paying users: ${data.stats.active_users_count}
- Summaries processed: ${data.stats.summaries_processed}

${data.vin_notes ? `## Vin's personal notes for this episode\n${data.vin_notes}` : ""}

# Your task
Write Episode ${episodeNumber} as a serial story chapter. Start by callbacks to last week's cliffhanger or open threads. Tell this week through scenes and moments, not lists. End with a NEW cliffhanger that will hook readers for next week. Update the arc state to reflect the evolution.

Return strict JSON only.`;
}

const sleep = async (ms: number) => new Promise((r) => setTimeout(r, ms));

function isTransientError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes("503") ||
    msg.includes("429") ||
    msg.includes("Service Unavailable") ||
    msg.includes("high demand") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("UNAVAILABLE")
  );
}

function extractJson(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const fenceMatch = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/i.exec(trimmed);
  if (fenceMatch) return fenceMatch[1];
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return trimmed.slice(first, last + 1);
  }
  return null;
}

/**
 * Last-resort JSON repair. Gemini sometimes outputs Python-style objects
 * with single-quoted keys/values instead of valid JSON. This attempts to
 * convert the most common patterns. It's best-effort — if the content has
 * apostrophes inside single-quoted strings (e.g. French "C'est..."), this
 * will likely fail, but it's better than nothing.
 */
function repairJsonQuotes(text: string): string {
  let out = text;
  // 1. Single-quoted KEYS: {'key': ...} or ,'key': ... → "key":
  out = out.replace(/([{,]\s*)'([^']+?)'(\s*:)/g, '$1"$2"$3');
  // 2. Single-quoted VALUES without apostrophes inside: : 'value' → : "value"
  //    and: [' and ,' and ' ] and ' ,
  out = out.replace(/(:\s*)'([^'\\]*)'(\s*[,}\]])/g, '$1"$2"$3');
  out = out.replace(/([[,]\s*)'([^'\\]*)'(\s*[,}\]])/g, '$1"$2"$3');
  // 3. Trailing commas in objects/arrays
  out = out.replace(/,(\s*[}\]])/g, "$1");
  return out;
}

/**
 * Parse JSON, falling back to a repair attempt on failure.
 * Returns the parsed object or null.
 */
function safeParseJson(text: string): {
  value: unknown | null;
  repaired: boolean;
} {
  try {
    return { value: JSON.parse(text), repaired: false };
  } catch {
    // Try repair
    try {
      const repaired = repairJsonQuotes(text);
      return { value: JSON.parse(repaired), repaired: true };
    } catch {
      return { value: null, repaired: false };
    }
  }
}

async function callOpenRouter(
  systemPrompt: string,
  userPrompt: string,
): Promise<string | null> {
  if (!env.OPENROUTER_API_KEY) return null;
  try {
    const res = await fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://www.brief-tube.com",
        "X-Title": "BriefTube Weekly Letter",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.85,
        max_tokens: 4096,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      logger.error("[letters] openrouter http error", { status: res.status });
      return null;
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content ?? null;
  } catch (error) {
    logger.error("[letters] openrouter request failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function normalizeResponse(
  raw: unknown,
  fallbackEpisodeNumber: number,
): LetterDraftResponse | null {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const title = typeof obj.title === "string" ? obj.title : null;
  const subject = typeof obj.subject === "string" ? obj.subject : null;
  const intro =
    typeof obj.intro_narrative === "string" ? obj.intro_narrative : null;
  const cliffhanger =
    typeof obj.new_cliffhanger === "string" ? obj.new_cliffhanger : null;
  if (!title || !subject || !intro || !cliffhanger) return null;

  const update = (obj.arc_state_update ?? {}) as Partial<LetterArcState>;
  const arc_state_update: LetterArcState = {
    current_arc_title:
      update.current_arc_title ?? EMPTY_ARC_STATE.current_arc_title,
    current_arc_summary:
      update.current_arc_summary ?? EMPTY_ARC_STATE.current_arc_summary,
    open_threads: Array.isArray(update.open_threads) ? update.open_threads : [],
    characters: Array.isArray(update.characters)
      ? update.characters
      : EMPTY_ARC_STATE.characters,
    recurring_themes: Array.isArray(update.recurring_themes)
      ? update.recurring_themes
      : EMPTY_ARC_STATE.recurring_themes,
    last_episode_number: fallbackEpisodeNumber,
    last_cliffhanger: cliffhanger,
  };

  return {
    title,
    subject,
    intro_narrative: intro,
    new_cliffhanger: cliffhanger,
    arc_state_update,
  };
}

/**
 * Generate a weekly letter draft via Léa's narrative engine.
 * Uses the same retry-then-OpenRouter strategy as the support chat.
 */
export async function generateLetterDraft(params: {
  episodeNumber: number;
  weekStart: Date;
  weekEnd: Date;
  arcState: LetterArcState;
  data: LetterGeneratedData;
}): Promise<LetterDraftResponse | null> {
  if (!env.GEMINI_API_KEY) {
    logger.error("[letters] GEMINI_API_KEY missing");
    return null;
  }

  const userPrompt = buildUserPrompt(params);
  const genAi = new GoogleGenerativeAI(env.GEMINI_API_KEY);

  const attempts: { model: string; delayMs: number }[] = [
    { model: NARRATIVE_MODEL_PRIMARY, delayMs: 0 },
    { model: NARRATIVE_MODEL_PRIMARY, delayMs: 1000 },
    { model: NARRATIVE_MODEL_FALLBACK, delayMs: 2500 },
  ];

  let rawText: string | null = null;
  for (const attempt of attempts) {
    if (attempt.delayMs > 0)
      // eslint-disable-next-line no-await-in-loop
      await sleep(attempt.delayMs);
    try {
      const model = genAi.getGenerativeModel({
        model: attempt.model,
        systemInstruction: NARRATIVE_PERSONA,
        generationConfig: {
          temperature: 0.85,
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
        },
      });
      // eslint-disable-next-line no-await-in-loop
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      });
      rawText = result.response.text();
      break;
    } catch (error) {
      logger.warn("[letters] gemini attempt failed", {
        model: attempt.model,
        error: error instanceof Error ? error.message : String(error),
      });
      if (!isTransientError(error)) break;
    }
  }

  if (rawText === null) {
    logger.warn("[letters] all gemini attempts failed, trying OpenRouter");
    rawText = await callOpenRouter(NARRATIVE_PERSONA, userPrompt);
  }

  if (rawText === null) {
    logger.error("[letters] all providers failed");
    return null;
  }

  const jsonText = extractJson(rawText);
  if (!jsonText) {
    logger.error("[letters] no JSON block found in response", {
      length: rawText.length,
      preview: rawText.slice(0, 500),
      tail: rawText.slice(-200),
    });
    return null;
  }

  const { value: parsed, repaired } = safeParseJson(jsonText);
  if (!parsed) {
    logger.error("[letters] JSON parse failed even after repair", {
      length: jsonText.length,
      preview: jsonText.slice(0, 500),
      tail: jsonText.slice(-200),
    });
    return null;
  }
  if (repaired) {
    logger.warn("[letters] JSON was repaired (Gemini output single-quoted)", {
      episodeNumber: params.episodeNumber,
    });
  }

  return normalizeResponse(parsed, params.episodeNumber);
}
