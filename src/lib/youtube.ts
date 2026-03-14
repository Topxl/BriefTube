import { logger } from "./logger";

type YouTubeChannelInfo = {
  channelId: string;
  channelName: string;
  channelAvatarUrl: string;
};

/**
 * Fetch channel info by scraping YouTube page (no API key needed)
 * Simple, free, and works for all channels
 */
export async function getYouTubeChannelInfo(
  channelIdOrHandle: string,
): Promise<YouTubeChannelInfo> {
  try {
    // Build YouTube channel URL
    const channelUrl = channelIdOrHandle.startsWith("@")
      ? `https://www.youtube.com/${channelIdOrHandle}`
      : channelIdOrHandle.startsWith("UC")
        ? `https://www.youtube.com/channel/${channelIdOrHandle}`
        : `https://www.youtube.com/@${channelIdOrHandle}`;

    logger.info("Fetching channel info from:", channelUrl);

    // Fetch the YouTube page
    const response = await fetch(channelUrl, {
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch channel: ${response.status}`);
    }

    const html = await response.text();

    // Extract channel name from meta tags
    const nameMatch =
      html.match(/<meta property="og:title" content="([^"]+)"/) ??
      html.match(/<meta name="title" content="([^"]+)"/);
    const channelName = nameMatch ? nameMatch[1] : channelIdOrHandle;

    // Extract avatar from meta tags
    const avatarMatch = html.match(
      /<meta property="og:image" content="([^"]+)"/,
    );
    const channelAvatarUrl = avatarMatch
      ? avatarMatch[1]
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(channelName)}&background=dc2626&color=fff&size=128`;

    // Extract real channel ID from canonical URL or page source
    const canonicalMatch = html.match(/channel\/([A-Za-z0-9_-]{24})/);
    const finalChannelId = canonicalMatch
      ? canonicalMatch[1]
      : channelIdOrHandle;

    logger.info("Channel info extracted:", {
      channelId: finalChannelId,
      channelName,
      hasAvatar: !!avatarMatch,
    });

    return {
      channelId: finalChannelId,
      channelName,
      channelAvatarUrl,
    };
  } catch (error) {
    logger.error("Failed to fetch YouTube channel info:", error);

    // Fallback to basic info with generated avatar
    return {
      channelId: channelIdOrHandle,
      channelName: channelIdOrHandle,
      channelAvatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(channelIdOrHandle)}&background=dc2626&color=fff&size=128`,
    };
  }
}
