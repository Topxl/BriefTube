import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = request.nextUrl.searchParams.get("url") ?? "";
  if (!url) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }

  // Detect video URL
  const videoMatch = url.match(
    /(?:watch\?(?:[^&]*&)*v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );

  let type: "video" | "channel" = "channel";
  let videoId: string | undefined;
  let title: string | undefined;
  let channelName = "";
  let channelId = "";
  let thumbnail: string | undefined;

  if (videoMatch) {
    type = "video";
    videoId = videoMatch[1];
    thumbnail = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
    try {
      const oembedRes = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
        { next: { revalidate: 3600 } },
      );
      if (oembedRes.ok) {
        const data = (await oembedRes.json()) as {
          title: string;
          author_name: string;
          author_url: string;
        };
        title = data.title;
        channelName = data.author_name;
        const handleMatch = data.author_url.match(/\/@([a-zA-Z0-9_-]+)/);
        channelId = handleMatch ? `@${handleMatch[1]}` : data.author_name;
      }
    } catch {
      /* ignore */
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
