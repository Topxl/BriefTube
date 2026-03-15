/**
 * Extract an 11-character YouTube video ID from any YouTube URL format.
 * Works on client and server (pure function, no network call).
 *
 * Handles:
 *   youtube.com/watch?v=ID
 *   youtu.be/ID
 *   youtube.com/shorts/ID
 *   youtube.com/embed/ID
 *   bare 11-char ID
 */
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?(?:[^&]*&)*v=|youtu\.be\/)([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  if (/^[\w-]{11}$/.test(url.trim())) return url.trim();
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
