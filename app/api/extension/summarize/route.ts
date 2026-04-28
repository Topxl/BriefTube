import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { corsPreflight, extensionRoute } from "@/lib/extension-route";
import {
  getUserQuotaSnapshot,
  incrementUserUsage,
} from "@/lib/extension-quota";
import {
  buildSummaryPrompt,
  getMaxTokensForLength,
  type LengthPref,
} from "@/lib/summary-prompt";
import { createAdminClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { authRateLimit, checkRateLimit } from "@/lib/rate-limit";

const GEMINI_PRIMARY = "gemini-2.5-flash";
const GEMINI_FALLBACK = "gemini-2.5-flash-lite";

const bodySchema = z.object({
  videoId: z.string().min(6).max(20),
  videoTitle: z.string().max(500).optional(),
  channelId: z.string().max(100).optional(),
  channelName: z.string().max(500).optional(),
  transcript: z.string().min(50).max(400_000),
  sourceLanguage: z.string().max(10).optional(),
  targetLanguage: z.string().max(10).optional(),
  videoDurationSec: z.number().int().nonnegative().optional(),
  lengthPref: z.enum(["brief", "standard", "detailed", "auto"]).optional(),
  stylePref: z.enum(["narrative", "key_points", "actionable"]).optional(),
});
type Body = z.infer<typeof bodySchema>;

type ProfileRow = {
  preferred_language: string | null;
  summary_length_pref: string;
  summary_style: string;
  summary_custom_instructions: string;
};

export const OPTIONS = corsPreflight;

export const POST = extensionRoute
  .requireAuthenticated()
  .body(bodySchema)
  .handler(async (_req, { body, user }) => {
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const {
      videoId,
      videoTitle,
      channelId,
      channelName,
      transcript,
      sourceLanguage,
      targetLanguage,
      videoDurationSec,
      lengthPref,
      stylePref,
    } = body as Body;

    if (!env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Gemini not configured on server" },
        { status: 500 },
      );
    }

    const rl = await checkRateLimit(authRateLimit, `ext-summ:${user.id}`);
    if (rl) return rl;

    const supabase = createAdminClient();

    // Target language is known up-front: client sends user's preferred_language.
    // Knowing this before fetching profile/cache lets all three DB roundtrips
    // run in parallel and saves ~400 ms vs the old sequential pattern.
    const effectiveTarget = targetLanguage ?? sourceLanguage ?? "en";

    const profileQuery = supabase
      .from("profiles")
      .select(
        "preferred_language, summary_length_pref, summary_style, summary_custom_instructions",
      )
      .eq("id", user.id)
      .single();

    const cacheQuery = supabase
      .from("processed_videos")
      .select("summary, language, source_language, audio_url")
      .eq("video_id", videoId)
      .eq("language", effectiveTarget)
      .eq("status", "completed")
      .maybeSingle();

    const [quotaSnapshot, profileRes, cacheRes] = await Promise.all([
      getUserQuotaSnapshot(user.id),
      profileQuery,
      cacheQuery,
    ]);

    // Quota gate
    if (!quotaSnapshot.isPro && quotaSnapshot.remaining <= 0) {
      return NextResponse.json(
        {
          error: "quota_exceeded",
          message: "Daily free limit reached. Upgrade to Pro for unlimited.",
          quota: quotaSnapshot,
        },
        { status: 402 },
      );
    }

    // Cache hit — return immediately (typical round-trip < 800 ms)
    if (cacheRes.data?.summary) {
      logger.info(
        `[extension/summarize] cache hit for ${videoId} (${effectiveTarget})`,
      );
      return {
        summary: cacheRes.data.summary,
        language: cacheRes.data.language,
        sourceLanguage: cacheRes.data.source_language,
        audioUrl: cacheRes.data.audio_url,
        cached: true,
      };
    }

    // Build Gemini request using profile preferences when available
    const profile = profileRes.data as ProfileRow | null;
    const effectiveLength: LengthPref = (lengthPref ??
      profile?.summary_length_pref ??
      "auto") as LengthPref;
    const effectiveStyle =
      stylePref ??
      (profile?.summary_style as
        | "narrative"
        | "key_points"
        | "actionable"
        | undefined) ??
      "narrative";
    const customInstructions = profile?.summary_custom_instructions ?? "";

    const prompt = buildSummaryPrompt({
      transcript,
      sourceLanguage,
      targetLanguage: effectiveTarget,
      lengthPref: effectiveLength,
      stylePref: effectiveStyle,
      customInstructions,
    });

    // Hard token cap per length preset — soft prompt instructions are unreliable.
    // For 'auto', the cap scales with transcript length.
    const transcriptWords = transcript.split(/\s+/).length;
    const maxOutputTokens = getMaxTokensForLength(
      effectiveLength,
      transcriptWords,
    );

    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    let summary: string | null = null;
    let modelUsed: string | null = null;

    const tryModel = async (modelName: string) => {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          // Gemini 2.5 Flash enables `thinking` by default, which adds 5–10 s
          // of internal reasoning before it emits any output. That's useful for
          // math/code but pointless for summarization. Disabling it is the
          // single biggest latency win (~-7 s on a typical podcast transcript).
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens,
            thinkingConfig: { thinkingBudget: 0 },
          } as unknown as {
            temperature: number;
            maxOutputTokens: number;
          },
        });
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        if (text.length >= 100) return { text, modelName };
      } catch (err) {
        logger.warn(
          `[extension/summarize] model ${modelName} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      return null;
    };

    const primary = await tryModel(GEMINI_PRIMARY);
    if (primary) {
      summary = primary.text;
      modelUsed = primary.modelName;
    } else {
      const fallback = await tryModel(GEMINI_FALLBACK);
      if (fallback) {
        summary = fallback.text;
        modelUsed = fallback.modelName;
      }
    }

    if (!summary) {
      return NextResponse.json(
        { error: "summarization_failed" },
        { status: 502 },
      );
    }

    // Post-summary writes (persist + quota increment) are independent — run in
    // parallel to shave another ~150 ms off the response.
    const persistPromise = (async () => {
      try {
        const { data: existingRow } = await supabase
          .from("processed_videos")
          .select("id")
          .eq("video_id", videoId)
          .eq("language", effectiveTarget)
          .maybeSingle();

        if (existingRow) {
          await supabase
            .from("processed_videos")
            .update({
              summary,
              status: "completed",
              processed_at: new Date().toISOString(),
              video_title: videoTitle ?? undefined,
              source_language: sourceLanguage ?? null,
              transcript_length: transcript.length,
              transcript_source: "extension",
              summary_length: summary.length,
            })
            .eq("id", existingRow.id);
        } else {
          await supabase.from("processed_videos").insert({
            video_id: videoId,
            video_title: videoTitle ?? videoId,
            video_url: `https://www.youtube.com/watch?v=${videoId}`,
            channel_id: channelId ?? "",
            language: effectiveTarget,
            source_language: sourceLanguage ?? null,
            status: "completed",
            summary,
            summary_length: summary.length,
            transcript_length: transcript.length,
            transcript_source: "extension",
            processed_at: new Date().toISOString(),
            metadata: {
              origin: "extension",
              model: modelUsed,
              channel_name: channelName ?? null,
              duration_seconds: videoDurationSec ?? null,
            },
          });
        }
      } catch (err) {
        logger.warn(
          `[extension/summarize] persist failed for ${videoId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    })();

    const usagePromise = (async (): Promise<number | null> => {
      try {
        const newCount = await incrementUserUsage(user.id);
        return Math.max(0, 10 - newCount);
      } catch (err) {
        logger.warn(
          `[extension/summarize] quota increment failed: ${String(err)}`,
        );
        return null;
      }
    })();

    const [, quotaRemaining] = await Promise.all([
      persistPromise,
      usagePromise,
    ]);

    return {
      summary,
      language: effectiveTarget,
      sourceLanguage: sourceLanguage ?? null,
      cached: false,
      quotaRemaining,
      model: modelUsed,
    };
  });
