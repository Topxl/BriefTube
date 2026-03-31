import { createClient } from "@/lib/supabase/server";
import { extractVideoId, toThumbnailUrl } from "@/lib/youtube-id";
import { fetchVideoOembed } from "@/lib/youtube";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkRateLimit, authRateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(authRateLimit, user.id);
  if (rl) return rl;

  const url = request.nextUrl.searchParams.get("url") ?? "";
  if (!url) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }

  try {
    const parsed = new URL(url);
    const allowed = [
      "youtube.com",
      "www.youtube.com",
      "youtu.be",
      "m.youtube.com",
    ];
    if (!allowed.includes(parsed.hostname)) {
      return NextResponse.json(
        { error: "Only YouTube URLs are supported" },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  // Detect video URL
  const videoId = extractVideoId(url);

  let type: "video" | "channel" = "channel";
  let title: string | undefined;
  let channelName = "";
  let channelId = "";
  let thumbnail: string | undefined;

  if (videoId) {
    type = "video";
    thumbnail = toThumbnailUrl(videoId);
    const oembedData = await fetchVideoOembed(videoId);
    if (oembedData) {
      title = oembedData.title;
      channelName = oembedData.author_name;
      const handleMatch = oembedData.author_url.match(/\/@([a-zA-Z0-9_-]+)/);
      channelId = handleMatch ? `@${handleMatch[1]}` : oembedData.author_name;
    }
  } else {
    // Channel URL
    const handleMatch = url.match(/@([a-zA-Z0-9_-]+)/);
    if (handleMatch) {
      channelId = `@${handleMatch[1]}`;
      channelName = handleMatch[1];
    }
    const channelMatch = url.match(/channel\/([a-zA-Z0-9_-]+)/);
    if (channelMatch) {
      channelId = channelMatch[1];
      channelName = channelMatch[1];
    }
    // bare handle
    if (!channelId) {
      const bare = url.replace(/[@/]/g, "").trim();
      channelId = `@${bare}`;
      channelName = bare;
    }
  }

  // Check subscription
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("channel_id, channel_name")
    .eq("user_id", user.id);

  const normalizedChannelId = channelId.replace("@", "").toLowerCase();
  const isSubscribed = (subs ?? []).some((s) => {
    const c = s.channel_id.replace("@", "").toLowerCase();
    return (
      c === normalizedChannelId ||
      c.includes(normalizedChannelId) ||
      normalizedChannelId.includes(c)
    );
  });

  return NextResponse.json({
    type,
    videoId,
    title,
    channelName,
    channelId,
    thumbnail,
    isSubscribed,
  });
}
