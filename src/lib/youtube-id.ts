/**
 * Extract an 11-character YouTube video ID from any YouTube URL format.
 * Works on client and server (pure function, no network call).
 *
 * Handles:
 *   youtube.com/watch?v=ID
 *   youtu.be/ID
 *   youtube.com/shorts/ID
 *   youtube.com/embed/ID
 *   youtube.com/v/ID
 *   youtube.com/live/ID
 *   m.youtube.com/... (mobile)
 *   music.youtube.com/... (YouTube Music)
 *   URLs with extra params, timestamps, etc.
 *   bare 11-char ID
 */
export function extractVideoId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  // Bare ID
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;

  // Try all known URL patterns (supports m./music./www. variants)
  const patterns = [
    // youtube.com/watch?v=ID — v param can be anywhere in query string
    /[?&]v=([\w-]{11})/,
    // youtu.be/ID
    /youtu\.be\/([\w-]{11})/,
    // youtube.com/shorts/ID, /embed/ID, /v/ID, /live/ID
    /youtube\.com\/(?:shorts|embed|v|live)\/([\w-]{11})/,
    // Any path segment that looks like an 11-char ID (last resort)
    /\/([\w-]{11})(?:[/?#]|$)/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

/** Build a standard YouTube watch URL from a video ID. */
export function toVideoUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/** Build a YouTube thumbnail URL from a video ID. */
export function toThumbnailUrl(
  videoId: string,
  quality: "default" | "mqdefault" | "hqdefault" = "mqdefault",
): string {
  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
}
