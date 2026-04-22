/**
 * Extract transcripts directly from YouTube's in-page state. This is the
 * architectural win vs Eightify: the content script has access to the same
 * caption tracks the YouTube player uses, so we never pay for transcript
 * extraction on the server for the 80%+ of videos that ship with captions.
 */

export type CaptionTrack = {
  baseUrl: string;
  languageCode: string;
  name?: string;
  kind?: string; // "asr" means auto-generated
  vssId?: string;
};

type PlayerResponse = {
  videoDetails?: {
    videoId?: string;
    title?: string;
    channelId?: string;
    author?: string;
    lengthSeconds?: string;
  };
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: CaptionTrack[];
      defaultAudioTrackIndex?: number;
    };
  };
};

type InjectedWindow = Window &
  typeof globalThis & {
    ytInitialPlayerResponse?: PlayerResponse;
  };

/**
 * Read YouTube's `ytInitialPlayerResponse` global. When the page navigates via
 * SPA, this variable is updated by YouTube before the <title> mutation fires.
 */
export function getPlayerResponse(): PlayerResponse | null {
  const w = window as InjectedWindow;
  if (w.ytInitialPlayerResponse) return w.ytInitialPlayerResponse;

  // Fallback: scrape it from <script> tags (first page load before hydration)
  const scripts = Array.from(document.querySelectorAll("script"));
  for (const s of scripts) {
    const match = /ytInitialPlayerResponse\s*=\s*({[\s\S]+?});/.exec(
      s.textContent ?? "",
    );
    if (match) {
      try {
        return JSON.parse(match[1]) as PlayerResponse;
      } catch {
        // ignore
      }
    }
  }
  return null;
}

export function getCurrentVideoId(): string | null {
  const url = new URL(window.location.href);
  return url.searchParams.get("v");
}

export function pickBestCaptionTrack(
  tracks: CaptionTrack[],
  preferredLang: string,
): CaptionTrack | null {
  if (tracks.length === 0) return null;
  // 1. User-preferred language, non-ASR
  const manualPreferred = tracks.find(
    (t) => t.languageCode === preferredLang && t.kind !== "asr",
  );
  if (manualPreferred) return manualPreferred;

  // 2. English, non-ASR
  const manualEn = tracks.find(
    (t) => t.languageCode === "en" && t.kind !== "asr",
  );
  if (manualEn) return manualEn;

  // 3. Any manual (non-ASR)
  const anyManual = tracks.find((t) => t.kind !== "asr");
  if (anyManual) return anyManual;

  // 4. User-preferred ASR
  const asrPreferred = tracks.find((t) => t.languageCode === preferredLang);
  if (asrPreferred) return asrPreferred;

  // 5. Any ASR
  return tracks[0];
}

type SegmentEvent = {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: { utf8?: string }[];
};

type TimedText = {
  events?: SegmentEvent[];
};

export type ExtractedTranscript = {
  text: string;
  timedLines: { start: number; text: string }[];
  languageCode: string;
  auto: boolean;
};

export async function fetchTranscript(
  track: CaptionTrack,
): Promise<ExtractedTranscript> {
  // Force JSON format: much easier to parse than XML
  const url = new URL(track.baseUrl);
  url.searchParams.set("fmt", "json3");
  const res = await fetch(url.toString(), { credentials: "include" });
  if (!res.ok) throw new Error(`Transcript fetch failed: ${res.status}`);
  const data = (await res.json()) as TimedText;

  const timedLines: { start: number; text: string }[] = [];
  const textBuffer: string[] = [];
  for (const ev of data.events ?? []) {
    if (!ev.segs) continue;
    const txt = ev.segs
      .map((s) => s.utf8 ?? "")
      .join("")
      .replace(/\n+/g, " ")
      .trim();
    if (!txt) continue;
    const startSec = Math.round((ev.tStartMs ?? 0) / 1000);
    timedLines.push({ start: startSec, text: txt });
    textBuffer.push(txt);
  }

  return {
    text: textBuffer.join(" "),
    timedLines,
    languageCode: track.languageCode,
    auto: track.kind === "asr",
  };
}

export type VideoMeta = {
  videoId: string;
  videoTitle: string;
  channelId: string;
  channelName: string;
  durationSec: number;
  captions: CaptionTrack[];
};

function scrapeTitleFromDom(): string | null {
  const selectors = [
    "ytd-watch-metadata #title h1 yt-formatted-string",
    "h1.ytd-watch-metadata yt-formatted-string",
    "h1.title yt-formatted-string",
    'meta[itemprop="name"]',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const text =
      el instanceof HTMLMetaElement
        ? el.content
        : (el.textContent ?? "").trim();
    if (text) return text;
  }
  return null;
}

function scrapeChannelFromDom(): { id: string; name: string } {
  const nameEl = document.querySelector(
    "#owner ytd-channel-name #text a, #owner ytd-channel-name #text, ytd-video-owner-renderer #channel-name a",
  );
  const name = (nameEl?.textContent ?? "").trim();
  // channelId is harder to scrape; best-effort from the href
  const linkEl = document.querySelector<HTMLAnchorElement>(
    "#owner ytd-channel-name a[href*='/channel/'], #owner ytd-channel-name a[href*='/@']",
  );
  const href = linkEl?.href ?? "";
  const match = /\/channel\/([^/?]+)/.exec(href);
  const id = match ? match[1] : "";
  return { id, name };
}

export function extractVideoMeta(): VideoMeta | null {
  const videoId = getCurrentVideoId();
  if (!videoId) return null;

  const player = getPlayerResponse();
  const details = player?.videoDetails ?? {};
  const captions =
    player?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];

  // `ytInitialPlayerResponse` is injected at first page load only. After a
  // SPA navigation YouTube replaces the video without updating that global,
  // so its videoDetails still reference the *previous* video. When we detect
  // that mismatch, fall back to DOM scraping so the sidebar still has title
  // + channel. Captions will be empty in that branch — the extension will
  // route to the Whisper pipeline via the server, which is fine.
  const playerMatchesCurrent =
    !!details.videoId && details.videoId === videoId;
  if (playerMatchesCurrent) {
    return {
      videoId,
      videoTitle: details.title ?? videoId,
      channelId: details.channelId ?? "",
      channelName: details.author ?? "",
      durationSec: details.lengthSeconds ? Number(details.lengthSeconds) : 0,
      captions,
    };
  }

  // Stale or missing player response — scrape the DOM instead.
  const { id: domChannelId, name: domChannelName } = scrapeChannelFromDom();
  return {
    videoId,
    videoTitle: scrapeTitleFromDom() ?? videoId,
    channelId: domChannelId,
    channelName: domChannelName,
    durationSec: 0,
    captions: [],
  };
}

/** Seek the YouTube player to a given time (in seconds). */
export function seekTo(seconds: number) {
  const video = document.querySelector<HTMLVideoElement>(
    "video.html5-main-video",
  );
  if (video) {
    video.currentTime = seconds;
    video.play().catch(() => {
      /* ignore autoplay restrictions */
    });
    return;
  }
  // Fallback via URL hash (always reloads, worst case)
  const url = new URL(window.location.href);
  url.searchParams.set("t", `${Math.floor(seconds)}s`);
  window.history.replaceState(null, "", url.toString());
}

export function getChannelAvatar(): string | null {
  const img = document.querySelector<HTMLImageElement>(
    "ytd-video-owner-renderer #avatar img, ytd-channel-renderer img, #owner yt-img-shadow img",
  );
  return img?.src ?? null;
}
