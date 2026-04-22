import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  authRateLimit,
  heavyRateLimit,
} from "@/lib/rate-limit";
import { decryptToken } from "@/lib/youtube/token-crypto";

type YouTubeSubscriptionItem = {
  snippet: {
    resourceId: { channelId: string };
    title: string;
    thumbnails?: {
      default?: { url: string };
      medium?: { url: string };
    };
  };
};

type YouTubeSubscriptionsResponse = {
  nextPageToken?: string;
  items: YouTubeSubscriptionItem[];
};

type ChannelEntry = {
  channelId: string;
  channelName: string;
  avatarUrl: string | null;
};

async function fetchAllSubscriptions(
  accessToken: string,
): Promise<ChannelEntry[]> {
  const channels: ChannelEntry[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      part: "snippet",
      mine: "true",
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });
    // eslint-disable-next-line no-await-in-loop
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/subscriptions?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) {
      // eslint-disable-next-line no-await-in-loop
      logger.error("YouTube API error (silent sync):", await res.text());
      break;
    }
    // eslint-disable-next-line no-await-in-loop
    const data = (await res.json()) as YouTubeSubscriptionsResponse;
    for (const item of data.items) {
      channels.push({
        channelId: item.snippet.resourceId.channelId,
        channelName: item.snippet.title,
        avatarUrl:
          item.snippet.thumbnails?.medium?.url ??
          item.snippet.thumbnails?.default?.url ??
          null,
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return channels;
}

// POST /api/youtube/sync/refresh — silent sync using stored refresh_token.
// Returns 200 with diff stored in profile (caller should redirect to
// /dashboard?youtube_sync=ready). Returns 404 if no refresh_token (caller
// should fall back to interactive OAuth at /api/youtube/auth?mode=sync).
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = await checkRateLimit(
    heavyRateLimit,
    `youtube-silent-sync:${user.id}`,
  );
  if (rateLimitResponse) return rateLimitResponse;

  const { data: profile } = await supabase
    .from("profiles")
    .select("youtube_refresh_token, youtube_refresh_token_iv")
    .eq("id", user.id)
    .single();

  if (!profile?.youtube_refresh_token || !profile.youtube_refresh_token_iv) {
    return NextResponse.json(
      { error: "No refresh token stored" },
      { status: 404 },
    );
  }

  const refreshToken = decryptToken({
    ciphertext: profile.youtube_refresh_token,
    iv: profile.youtube_refresh_token_iv,
  });

  if (!refreshToken) {
    logger.warn("Failed to decrypt refresh_token (key missing or rotated)");
    return NextResponse.json(
      { error: "Token decryption failed" },
      { status: 500 },
    );
  }

  // Exchange refresh_token for a fresh access_token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    logger.error("Refresh token exchange failed:", errText);
    // Token revoked or expired — clear it so the next attempt falls back to OAuth
    await supabase
      .from("profiles")
      .update({
        youtube_refresh_token: null,
        youtube_refresh_token_iv: null,
      })
      .eq("id", user.id);
    return NextResponse.json(
      { error: "Refresh token invalid" },
      { status: 401 },
    );
  }

  const { access_token } = (await tokenRes.json()) as { access_token: string };

  const youtubeChannels = await fetchAllSubscriptions(access_token);
  logger.info(
    `Silent sync: fetched ${youtubeChannels.length} YouTube subscriptions`,
  );

  const { data: existingSubs } = await supabase
    .from("subscriptions")
    .select("channel_id, channel_name, channel_avatar_url, active")
    .eq("user_id", user.id)
    .or(
      "source_type.is.null,source_type.eq.youtube_channel,source_type.eq.youtube_import",
    );

  const subs = existingSubs ?? [];
  const youtubeChannelIds = new Set(youtubeChannels.map((c) => c.channelId));
  const existingChannelIds = new Set(subs.map((s) => s.channel_id));

  const added = youtubeChannels
    .filter((c) => !existingChannelIds.has(c.channelId))
    .map((c) => ({
      channelId: c.channelId,
      channelName: c.channelName,
      avatarUrl: c.avatarUrl,
    }));

  const removed = subs
    .filter((s) => !youtubeChannelIds.has(s.channel_id))
    .map((s) => ({
      channelId: s.channel_id,
      channelName: s.channel_name,
      avatarUrl: s.channel_avatar_url,
    }));

  const unchanged = subs
    .filter((s) => youtubeChannelIds.has(s.channel_id))
    .map((s) => ({
      channelId: s.channel_id,
      channelName: s.channel_name,
      active: s.active,
    }));

  logger.info(
    `Silent sync diff: ${added.length} new, ${removed.length} removed, ${unchanged.length} unchanged`,
  );

  await supabase
    .from("profiles")
    .update({ youtube_sync_diff: { added, removed, unchanged } })
    .eq("id", user.id);

  return NextResponse.json({
    added: added.length,
    removed: removed.length,
    unchanged: unchanged.length,
  });
}

// GET → reuse the same authRateLimit just to keep parity. Returns 405 to make
// it clear the silent sync is POST-only.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = await checkRateLimit(
    authRateLimit,
    `youtube-silent-sync-get:${user.id}`,
  );
  if (rl) return rl;
  return NextResponse.json({ error: "Use POST" }, { status: 405 });
}
