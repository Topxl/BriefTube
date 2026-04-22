import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { corsPreflight, extensionRoute } from "@/lib/extension-route";
import { createAdminClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export const OPTIONS = corsPreflight;

/**
 * Production transcript archive path (see worker/transcript_store.py).
 * The worker writes every extraction here as `{video_id}.json`. When the
 * Supabase column is empty we fall back to this file so pre-migration videos
 * still expose their transcript to the extension.
 */
const VPS_TRANSCRIPT_DIR = "/home/brieftube/transcripts";

async function readFileTranscript(videoId: string): Promise<string | null> {
  try {
    const file = path.join(VPS_TRANSCRIPT_DIR, `${videoId}.json`);
    const buf = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(buf) as { text?: unknown };
    return typeof parsed.text === "string" && parsed.text.length > 0
      ? parsed.text
      : null;
  } catch {
    return null;
  }
}

/**
 * Poll the processing status for a video. Returns the cached summary, audio
 * URL and transcript when available so the extension's tabs can populate
 * without extra round-trips.
 */
export const GET = extensionRoute.handler(async (req, { user }) => {
  const videoId = req.nextUrl.pathname.split("/").pop();
  if (!videoId) {
    return NextResponse.json({ error: "missing_video_id" }, { status: 400 });
  }
  const lang = req.nextUrl.searchParams.get("lang") ?? "en";

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("processed_videos")
    .select(
      "status, summary, audio_url, language, source_language, video_title, transcript_text",
    )
    .eq("video_id", videoId)
    .eq("language", lang)
    .maybeSingle();

  if (!data) {
    return { status: "not_found" };
  }

  // Prefer the DB column when populated; otherwise fall back to the VPS
  // filesystem archive. If the DB is empty AND the file exists, backfill so
  // subsequent calls stay database-fast.
  let transcript: string | null = data.transcript_text ?? null;
  if (!transcript) {
    const fileTranscript = await readFileTranscript(videoId);
    if (fileTranscript) {
      transcript = fileTranscript;
      void supabase
        .from("processed_videos")
        .update({ transcript_text: fileTranscript })
        .eq("video_id", videoId)
        .eq("language", lang)
        .then(({ error }) => {
          if (error) {
            logger.warn(
              `[extension/status] transcript backfill failed for ${videoId}: ${error.message}`,
            );
          }
        });
    }
  }

  return {
    status: data.status ?? "pending",
    summary: data.summary ?? null,
    transcript,
    audioUrl: user && data.audio_url ? data.audio_url : null,
    language: data.language,
    sourceLanguage: data.source_language,
    videoTitle: data.video_title,
  };
});
