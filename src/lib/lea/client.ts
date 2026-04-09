import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  buildLeaSystemInstruction,
  fetchUserContext,
  historyToGeminiContents,
} from "./prompt";
import type { LeaMessage, LeaStructuredResponse } from "./types";

const LEA_MODEL_PRIMARY = "gemini-2.5-flash";
const LEA_MODEL_FALLBACK = "gemini-2.5-flash-lite";

/**
 * Detect if a Gemini error is a transient overload (503, 429, "high demand")
 * that's worth retrying.
 */
function isTransientGeminiError(error: unknown): boolean {
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

const sleep = async (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * OpenRouter is the final fallback when our direct Gemini API is down or
 * rate-limited. We use the same Gemini 2.5 Flash model via OpenRouter — they
 * have an independent quota and routing path, so this often succeeds when
 * direct calls don't (different network path, separate rate limits, queue).
 */
const OPENROUTER_MODEL = "google/gemini-2.5-flash";
const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

type OpenAIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/**
 * Convert the Gemini-format conversation contents into OpenAI-format messages.
 */
function geminiContentsToOpenAiMessages(
  contents: { role: "user" | "model"; parts: { text: string }[] }[],
): OpenAIMessage[] {
  return contents.map((c) => ({
    role: c.role === "model" ? "assistant" : "user",
    content: c.parts.map((p) => p.text).join("\n"),
  }));
}

/**
 * Final fallback: ask Léa via OpenRouter (Claude Haiku 4.5).
 * Returns the raw JSON text string on success, or null on failure.
 */
async function askLeaViaOpenRouter(params: {
  systemInstruction: string;
  contents: { role: "user" | "model"; parts: { text: string }[] }[];
  userId: string;
}): Promise<string | null> {
  if (!env.OPENROUTER_API_KEY) {
    logger.warn("[lea] openrouter: OPENROUTER_API_KEY not configured", {
      userId: params.userId,
    });
    return null;
  }

  const messages: OpenAIMessage[] = [
    { role: "system", content: params.systemInstruction },
    ...geminiContentsToOpenAiMessages(params.contents),
  ];

  try {
    const res = await fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://www.brief-tube.com",
        "X-Title": "BriefTube Léa Support",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages,
        temperature: 0.6,
        max_tokens: 1024,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      logger.error("[lea] openrouter: http error", {
        userId: params.userId,
        status: res.status,
        body: errBody.slice(0, 500),
      });
      return null;
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content || content.trim().length === 0) {
      logger.error("[lea] openrouter: empty content", {
        userId: params.userId,
      });
      return null;
    }
    logger.warn("[lea] askLea: succeeded via OpenRouter fallback", {
      userId: params.userId,
      model: OPENROUTER_MODEL,
    });
    return content;
  } catch (error) {
    logger.error("[lea] openrouter: request failed", {
      userId: params.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

let cachedClient: GoogleGenerativeAI | null = null;

function getGenAi(): GoogleGenerativeAI {
  if (!env.GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is not configured. Add it to Infisical /web path (or .env.local for dev).",
    );
  }
  cachedClient ??= new GoogleGenerativeAI(env.GEMINI_API_KEY);
  return cachedClient;
}

/**
 * Fallback when Gemini is permanently unreachable (key missing, parse failure,
 * unknown error). Auto-escalates to a human.
 */
export const LEA_FALLBACK_RESPONSE: LeaStructuredResponse = {
  message:
    "I'm having a technical issue answering right now. Vin will take over and get back to you as soon as possible.",
  should_escalate: true,
  escalation_reason: "lea_unavailable",
  detected_feature_request: null,
  confidence: 0,
  conversation_subject: null,
};

/**
 * Soft fallback when Gemini is overloaded after retries. Does NOT escalate
 * (the user can just try again in a moment). Returns the same content in
 * French and English so users see something useful regardless of language.
 */
const LEA_OVERLOADED_RESPONSE: LeaStructuredResponse = {
  message:
    "I'm overloaded right now (Google Gemini is experiencing a temporary spike in demand). Please try sending your message again in a few seconds — it usually clears up fast.",
  should_escalate: false,
  escalation_reason: null,
  detected_feature_request: null,
  confidence: 0,
  conversation_subject: null,
};

/**
 * Best-effort extraction of a JSON object from a Gemini response.
 * Gemini sometimes wraps the JSON in ```json fences or adds extra text.
 */
function extractJson(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }
  // Handle ```json ... ``` fences
  const fenceMatch = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/i.exec(trimmed);
  if (fenceMatch) return fenceMatch[1];
  // Find first { ... last }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return trimmed.slice(first, last + 1);
  }
  return null;
}

function normalizeResponse(
  raw: unknown,
  isFirstTurn: boolean,
): LeaStructuredResponse {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const message =
    typeof obj.message === "string" && obj.message.trim().length > 0
      ? obj.message.trim()
      : LEA_FALLBACK_RESPONSE.message;

  const shouldEscalate = Boolean(obj.should_escalate);

  const escalationReason =
    typeof obj.escalation_reason === "string" &&
    obj.escalation_reason.length > 0
      ? obj.escalation_reason
      : null;

  let detectedFeatureRequest: LeaStructuredResponse["detected_feature_request"] =
    null;
  if (
    obj.detected_feature_request &&
    typeof obj.detected_feature_request === "object"
  ) {
    const fr = obj.detected_feature_request as Record<string, unknown>;
    if (
      typeof fr.title === "string" &&
      typeof fr.description === "string" &&
      typeof fr.category === "string"
    ) {
      const validCategories = [
        "feature",
        "improvement",
        "integration",
        "ui_ux",
        "other",
      ] as const;
      const category = (validCategories as readonly string[]).includes(
        fr.category,
      )
        ? (fr.category as (typeof validCategories)[number])
        : "feature";
      detectedFeatureRequest = {
        title: fr.title,
        description: fr.description,
        category,
      };
    }
  }

  let confidence = typeof obj.confidence === "number" ? obj.confidence : 0.5;
  if (Number.isNaN(confidence)) confidence = 0.5;
  confidence = Math.max(0, Math.min(1, confidence));

  const conversationSubject =
    isFirstTurn &&
    typeof obj.conversation_subject === "string" &&
    obj.conversation_subject.trim().length > 0
      ? obj.conversation_subject.trim()
      : null;

  const normalized: LeaStructuredResponse = {
    message,
    should_escalate: shouldEscalate,
    escalation_reason: escalationReason,
    detected_feature_request: detectedFeatureRequest,
    confidence,
    conversation_subject: conversationSubject,
  };

  // Auto-escalate on low confidence
  if (normalized.confidence < 0.55 && !normalized.should_escalate) {
    normalized.should_escalate = true;
    normalized.escalation_reason ??= "low_confidence";
  }

  return normalized;
}

/**
 * Ask Léa to answer the user's latest message.
 *
 * Each failure path is logged with a distinct tag so we can identify what
 * went wrong from the server logs (gemini_key_missing, gemini_call_failed,
 * gemini_parse_failed, etc.).
 */
export async function askLea(params: {
  userId: string;
  history: LeaMessage[];
  newMessage: string;
  isFirstTurn: boolean;
}): Promise<LeaStructuredResponse> {
  const { userId, history, newMessage, isFirstTurn } = params;

  // 1. Fetch user context
  let userContext;
  try {
    userContext = await fetchUserContext(userId);
  } catch (error) {
    logger.error("[lea] askLea: failed to fetch user context", {
      userId,
      error: String(error),
    });
    return LEA_FALLBACK_RESPONSE;
  }
  if (!userContext) {
    logger.error("[lea] askLea: user context not found", { userId });
    return LEA_FALLBACK_RESPONSE;
  }

  // 2. Build system instruction
  let systemInstruction: string;
  try {
    systemInstruction = await buildLeaSystemInstruction(userContext);
  } catch (error) {
    logger.error("[lea] askLea: failed to build system instruction", {
      userId,
      error: String(error),
    });
    return LEA_FALLBACK_RESPONSE;
  }

  // 3. Get Gemini client
  let genAi: GoogleGenerativeAI;
  try {
    genAi = getGenAi();
  } catch (error) {
    logger.error("[lea] askLea: gemini_key_missing", {
      userId,
      error: String(error),
    });
    return LEA_FALLBACK_RESPONSE;
  }

  // 4. Call Gemini with retries on transient errors + fallback model
  const turnNote = isFirstTurn
    ? "\n\n(This is the very first message of the conversation. Fill conversation_subject with a short title summarizing the request.)"
    : "";

  const contents = [
    ...historyToGeminiContents(history),
    {
      role: "user" as const,
      parts: [{ text: `[USER_MESSAGE]: ${newMessage}${turnNote}` }],
    },
  ];

  // Retry strategy:
  //   attempt 1: primary model
  //   attempt 2: primary model after 800 ms
  //   attempt 3: fallback model after 2000 ms
  const attempts: { model: string; delayMs: number }[] = [
    { model: LEA_MODEL_PRIMARY, delayMs: 0 },
    { model: LEA_MODEL_PRIMARY, delayMs: 800 },
    { model: LEA_MODEL_FALLBACK, delayMs: 2000 },
  ];

  let rawText: string | null = null;
  let lastError: unknown = null;
  let lastErrorTransient = false;

  for (const attempt of attempts) {
    // Sequential awaits are intentional: retries must wait for prior attempt
    // eslint-disable-next-line no-await-in-loop
    if (attempt.delayMs > 0) await sleep(attempt.delayMs);
    try {
      const model = genAi.getGenerativeModel({
        model: attempt.model,
        systemInstruction,
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 1024,
          responseMimeType: "application/json",
        },
      });
      // eslint-disable-next-line no-await-in-loop
      const result = await model.generateContent({ contents });
      rawText = result.response.text();
      if (attempt.model !== LEA_MODEL_PRIMARY) {
        logger.warn("[lea] askLea: succeeded on fallback model", {
          userId,
          model: attempt.model,
        });
      }
      break;
    } catch (error) {
      lastError = error;
      lastErrorTransient = isTransientGeminiError(error);
      logger.warn("[lea] askLea: gemini attempt failed", {
        userId,
        model: attempt.model,
        transient: lastErrorTransient,
        error: error instanceof Error ? error.message : String(error),
      });
      // If the error is NOT transient, no point retrying
      if (!lastErrorTransient) break;
    }
  }

  if (rawText === null) {
    logger.warn("[lea] askLea: all gemini attempts failed, trying OpenRouter", {
      userId,
      transient: lastErrorTransient,
    });
    // Last resort: try OpenRouter (Claude Haiku 4.5, different infra)
    rawText = await askLeaViaOpenRouter({
      systemInstruction,
      contents,
      userId,
    });
  }

  if (rawText === null) {
    logger.error("[lea] askLea: all providers failed", {
      userId,
      transient: lastErrorTransient,
      error: lastError instanceof Error ? lastError.message : String(lastError),
    });
    // Soft fallback (no escalation) if Gemini was overloaded and OpenRouter
    // also missed — user can just retry. Hard fallback (escalation) otherwise.
    return lastErrorTransient ? LEA_OVERLOADED_RESPONSE : LEA_FALLBACK_RESPONSE;
  }

  // 5. Parse JSON
  const jsonText = extractJson(rawText);
  if (!jsonText) {
    logger.error("[lea] askLea: gemini_parse_failed_no_json", {
      userId,
      preview: rawText.slice(0, 500),
    });
    return LEA_FALLBACK_RESPONSE;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    logger.error("[lea] askLea: gemini_parse_failed_invalid_json", {
      userId,
      error: String(error),
      preview: jsonText.slice(0, 500),
    });
    return LEA_FALLBACK_RESPONSE;
  }

  return normalizeResponse(parsed, isFirstTurn);
}
