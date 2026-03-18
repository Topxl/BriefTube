import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { logger } from "@/lib/logger";

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

  // Pagination is inherently sequential — each page depends on the previous token
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
      logger.error("YouTube API error:", await res.text());
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

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    logger.error("YouTube OAuth error:", error);
    return NextResponse.redirect(
      new URL("/onboarding?youtube_error=access_denied", baseUrl),
    );
  }

  // Verify CSRF state
  const cookieStore = await cookies();
  const savedState = cookieStore.get("youtube_oauth_state")?.value;
  cookieStore.delete("youtube_oauth_state");

  if (!state || state !== savedState) {
    return NextResponse.redirect(
      new URL("/onboarding?youtube_error=invalid_state", baseUrl),
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/onboarding?youtube_error=no_code", baseUrl),
    );
  }

  // Verify user is authenticated
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", baseUrl));
  }

  // Exchange code for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: `${baseUrl}/api/youtube/callback`,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    logger.error("Token exchange failed:", await tokenRes.text());
    return NextResponse.redirect(
      new URL("/dashboard/channels?youtube_error=token_failed", baseUrl),
    );
  }

  const { access_token } = (await tokenRes.json()) as { access_token: string };

  // Fetch existing subscriptions and YouTube channels in parallel
  const [existingSubsRes, youtubeChannels] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("channel_id, active")
      .eq("user_id", user.id),
    fetchAllSubscriptions(access_token),
  ]);

  logger.info(`Fetched ${youtubeChannels.length} YouTube subscriptions`);

  // Filter out already-subscribed channels (active or inactive)
  const existingChannelIds = new Set(
    (existingSubsRes.data ?? []).map((s) => s.channel_id),
  );

  // Import ALL non-duplicate channels as inactive by default
  const toImport = youtubeChannels
    .filter((c) => !existingChannelIds.has(c.channelId))
    .map((c) => ({
      user_id: user.id,
      channel_id: c.channelId,
      channel_name: c.channelName,
      channel_avatar_url: c.avatarUrl,
      active: false,
    }));

  const skipped = youtubeChannels.length - toImport.length;

  const { data: inserted, error: insertError } = await supabase
    .from("subscriptions")
    .insert(toImport)
    .select();

  if (insertError) {
    logger.error("Bulk insert failed:", insertError);
    return NextResponse.redirect(
      new URL("/onboarding?youtube_error=import_failed", baseUrl),
    );
  }

  const imported = inserted.length;
  logger.info(`Import complete: ${imported} imported, ${skipped} skipped`);

  // Pre-mark existing RSS videos as "skipped" in the background — after the
  // redirect is sent. This prevents the RSS scanner (every 5 min) from treating
  // historical videos as new, without blocking the user during import.
  if (toImport.length > 0) {
    after(async () => {
      logger.info(
        `Pre-marking existing videos for ${toImport.length} channels (background)...`,
      );
      const rssResults = await Promise.allSettled(
        toImport.map(async (ch) => {
          try {
            const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${ch.channel_id}`;
            const rssRes = await fetch(rssUrl, {
              signal: AbortSignal.timeout(5000),
            });
            if (!rssRes.ok) return [];
            const rssText = await rssRes.text();
            const entries = [
              ...rssText.matchAll(/<entry>([\s\S]*?)<\/entry>/g),
            ].map((m) => m[1]);
            return entries
              .map((entry) => ({
                video_id:
                  entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1] ?? null,
                channel_id: ch.channel_id,
              }))
              .filter(
                (v): v is { video_id: string; channel_id: string } =>
                  !!v.video_id,
              );
          } catch {
            return [];
          }
        }),
      );
      const allVideos = rssResults.flatMap((r) =>
        r.status === "fulfilled" ? r.value : [],
      );
      if (allVideos.length > 0) {
        const supabaseBg = await createClient();
        const { error: upsertError } = await supabaseBg
          .from("processed_videos")
          .upsert(
            allVideos.map((v) => ({
              video_id: v.video_id,
              channel_id: v.channel_id,
              video_title: "[pre-subscription-import]",
              video_url: `https://www.youtube.com/watch?v=${v.video_id}`,
              status: "skipped",
              language: "fr",
            })),
            { onConflict: "video_id,language", ignoreDuplicates: true },
          );
        if (upsertError) {
          logger.error("Failed to pre-mark videos as skipped:", upsertError);
        } else {
          logger.info(
            `Pre-marked ${allVideos.length} videos as skipped across ${toImport.length} channels`,
          );
        }
      }
    });
  }

  return NextResponse.redirect(
    new URL(
      `/onboarding?youtube_imported=${imported}&youtube_skipped=${skipped}`,
      baseUrl,
    ),
  );
}
