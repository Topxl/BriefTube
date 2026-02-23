import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// YouTube requires a response in < 5 seconds
export const maxDuration = 10;

// ── GET — WebSub hub verification ─────────────────────────────

export const GET = async (req: NextRequest) => {
  const { searchParams } = req.nextUrl;

  const mode = searchParams.get("hub.mode");
  const challenge = searchParams.get("hub.challenge");
  const topic = searchParams.get("hub.topic");
  const leaseSeconds = searchParams.get("hub.lease_seconds");

  if (!mode || !challenge) {
    return NextResponse.json(
      { error: "Missing hub parameters" },
      { status: 400 },
    );
  }

  if (mode !== "subscribe" && mode !== "unsubscribe") {
    return NextResponse.json({ error: "Invalid hub.mode" }, { status: 400 });
  }

  // Update expires_at in DB when a subscribe is verified
  if (mode === "subscribe" && topic && leaseSeconds) {
    const channelId = extractChannelIdFromTopic(topic);
    if (channelId) {
      const lease = parseInt(leaseSeconds, 10);
      const expiresAt = new Date(Date.now() + lease * 1000).toISOString();
      try {
        const supabase = await createClient();
        await supabase
          .from("websub_subscriptions")
          .update({ status: "active", expires_at: expiresAt })
          .eq("channel_id", channelId);
        logger.info(
          `[WebSub] Verified subscribe for channel ${channelId}, expires ${expiresAt}`,
        );
      } catch (e) {
        logger.warn(
          "[WebSub] Could not update websub_subscriptions after verification:",
          e,
        );
      }
    }
  }

  // Return challenge as plain text — required by the WebSub spec
  return new Response(challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
};

// ── POST — new video notification ──────────────────────────────

export const POST = async (req: NextRequest) => {
  const body = await req.text();

  // Verify HMAC-SHA1 signature if WEBSUB_SECRET is configured
  if (env.WEBSUB_SECRET) {
    const signature = req.headers.get("x-hub-signature");
    if (!signature) {
      logger.warn("[WebSub] POST received without x-hub-signature — rejecting");
      return NextResponse.json({ error: "Missing signature" }, { status: 403 });
    }

    const isValid = await verifyHmacSha1(env.WEBSUB_SECRET, body, signature);
    if (!isValid) {
      logger.warn("[WebSub] Invalid HMAC-SHA1 signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }
  }

  // Parse the Atom XML from YouTube
  const videoId = extractTag(body, "yt:videoId");
  const channelId = extractTag(body, "yt:channelId");
  const title = extractXmlValue(body, "title");

  if (!videoId || !channelId) {
    // YouTube sometimes sends delete notifications — ignore silently
    return NextResponse.json({ ok: true });
  }

  logger.info(
    `[WebSub] New video notification: ${videoId} from channel ${channelId} — "${title}"`,
  );

  try {
    const supabase = await createClient();

    // Verify channel has active subscribers
    const { data: subs } = await supabase
      .from("subscriptions")
      .select("user_id")
      .eq("channel_id", channelId)
      .eq("active", true);

    if (!subs || subs.length === 0) {
      logger.info(
        `[WebSub] No active subscribers for channel ${channelId} — ignoring`,
      );
      return NextResponse.json({ ok: true });
    }

    // Check if video is already known
    const { data: existing } = await supabase
      .from("processed_videos")
      .select("video_id")
      .eq("video_id", videoId)
      .limit(1);

    if (existing && existing.length > 0) {
      logger.info(`[WebSub] Video ${videoId} already known — skipping`);
      return NextResponse.json({ ok: true });
    }

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const videoTitle = title ?? videoId;

    // Get distinct (language, tts_voice) pairs from subscribers
    const userIds = [...new Set(subs.map((s) => s.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, preferred_language, tts_voice")
      .in("id", userIds);

    // Build unique language → tts_voice map (preserves insertion order)
    const langMap = new Map<string, string | null>();
    for (const p of profiles ?? []) {
      const lang = p.preferred_language ?? "fr";
      if (!langMap.has(lang)) {
        langMap.set(lang, p.tts_voice ?? null);
      }
    }

    if (langMap.size === 0) {
      logger.warn(
        `[WebSub] No language profiles found for channel ${channelId}`,
      );
      return NextResponse.json({ ok: true });
    }

    const languages = [...langMap.keys()];

    // Insert processed_videos rows for all languages in parallel
    await Promise.all(
      languages.map((language) =>
        supabase.from("processed_videos").upsert(
          {
            video_id: videoId,
            channel_id: channelId,
            video_title: videoTitle,
            video_url: videoUrl,
            status: "pending",
            language,
          },
          { onConflict: "video_id,language", ignoreDuplicates: true },
        ),
      ),
    );

    // Create one processing_queue job per video (first language wins, mirrors rss_scanner)
    const { data: existingJob } = await supabase
      .from("processing_queue")
      .select("id")
      .eq("video_id", videoId)
      .limit(1);

    if (!existingJob || existingJob.length === 0) {
      const [firstLang, firstVoice] = [...langMap.entries()][0];
      await supabase.from("processing_queue").insert({
        video_id: videoId,
        youtube_url: videoUrl,
        video_title: videoTitle,
        channel_id: channelId,
        status: "queued",
        user_language: firstLang,
        ...(firstVoice ? { tts_voice: firstVoice } : {}),
      });
    }

    // Fetch all existing deliveries for this video in one query to avoid N+1
    const { data: existingDeliveries } = await supabase
      .from("deliveries")
      .select("user_id, language")
      .eq("video_id", videoId);

    const existingDeliverySet = new Set(
      (existingDeliveries ?? []).map((d) => `${d.user_id}:${d.language}`),
    );

    // Collect missing delivery rows across all languages, then batch insert
    const deliveriesToInsert: {
      user_id: string;
      video_id: string;
      status: "pending";
      language: string;
    }[] = [];

    for (const language of languages) {
      const matchingUsers = (profiles ?? []).filter(
        (p) => (p.preferred_language ?? "fr") === language,
      );
      for (const profile of matchingUsers) {
        if (!existingDeliverySet.has(`${profile.id}:${language}`)) {
          deliveriesToInsert.push({
            user_id: profile.id,
            video_id: videoId,
            status: "pending",
            language,
          });
        }
      }
    }

    if (deliveriesToInsert.length > 0) {
      await supabase.from("deliveries").insert(deliveriesToInsert);
    }

    logger.info(
      `[WebSub] Video ${videoId} enqueued for ${langMap.size} language(s): ${languages.join(", ")}`,
    );
  } catch (e) {
    logger.error("[WebSub] Error processing notification:", e);
    // Return 200 anyway — YouTube retries on non-2xx, which would cause duplicates
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
};

// ── Helpers ────────────────────────────────────────────────────

function extractTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>([^<]+)</${tag}>`));
  return match?.[1] ?? null;
}

function extractXmlValue(xml: string, tag: string): string | null {
  // Skip the first <title> (feed title) — return the entry title
  const matches = [
    ...xml.matchAll(new RegExp(`<${tag}>([^<]+)</${tag}>`, "g")),
  ];
  return matches.length >= 2 ? matches[1][1] : (matches[0]?.[1] ?? null);
}

function extractChannelIdFromTopic(topic: string): string | null {
  const match = topic.match(/channel_id=([A-Za-z0-9_-]+)/);
  return match?.[1] ?? null;
}

async function verifyHmacSha1(
  secret: string,
  body: string,
  signature: string,
): Promise<boolean> {
  // signature format: "sha1=<hex>"
  if (!signature.startsWith("sha1=")) return false;
  const expectedHex = signature.slice(5);

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-1" },
      false,
      ["sign"],
    );
    const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const actualHex = Array.from(new Uint8Array(mac))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Constant-time comparison to prevent timing attacks
    if (actualHex.length !== expectedHex.length) return false;
    let diff = 0;
    for (let i = 0; i < actualHex.length; i++) {
      diff |= actualHex.charCodeAt(i) ^ expectedHex.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}
