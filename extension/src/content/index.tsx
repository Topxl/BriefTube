import { createRoot, type Root } from "react-dom/client";
import { StrictMode, useCallback, useEffect, useState } from "react";
import {
  extractVideoMeta,
  fetchTranscript,
  getChannelAvatar,
  pickBestCaptionTrack,
  type ExtractedTranscript,
  type VideoMeta,
} from "./transcript";
import { Sidebar } from "./sidebar";
import type {
  MeResponse,
  StatusResponse,
  SummarizeResponse,
} from "@/lib/types";
import globalsCss from "@/styles/globals.css?inline";

const SIDEBAR_HOST_ID = "brieftube-sidebar-host";

// When the content script reloads (extension update, dev refresh), the
// previously-injected host element is still in the DOM with its old inline
// styles. Strip it so this fresh run starts from a clean slate.
document.getElementById(SIDEBAR_HOST_ID)?.remove();

type Msg =
  | { type: "ME" }
  | { type: "SUMMARIZE"; payload: unknown }
  | { type: "ENQUEUE"; payload: unknown }
  | { type: "STATUS"; payload: { videoId: string; language: string } }
  | { type: "SUBSCRIBE_CHANNEL"; payload: unknown }
  | { type: "SIGN_IN" }
  | { type: "SIGN_OUT" };

async function sendMessage<T>(msg: Msg): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      msg,
      (response: { ok: boolean; data?: T; error?: string }) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response.ok) {
          reject(new Error(response.error ?? "Unknown error"));
          return;
        }
        resolve(response.data as T);
      },
    );
  });
}

function App() {
  const [meta, setMeta] = useState<VideoMeta | null>(null);
  const [transcript, setTranscript] = useState<ExtractedTranscript | null>(
    null,
  );
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [summary, setSummary] = useState<SummarizeResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState<
    "idle" | "pending" | "done" | "error"
  >("idle");

  useEffect(() => {
    let lastVideoId: string | null = null;
    const resetState = () => {
      setMeta(null);
      setTranscript(null);
      setTranscriptError(null);
      setSummary(null);
      setSummaryError(null);
      setSubscribed("idle");
    };
    const check = () => {
      const url = new URL(window.location.href);
      const videoId = url.searchParams.get("v");
      if (!videoId) {
        if (lastVideoId !== null) {
          lastVideoId = null;
          resetState();
        }
        return;
      }
      // URL changed to a new video — reset immediately, don't wait for
      // ytInitialPlayerResponse to catch up. Otherwise the sidebar shows the
      // previous summary while the new URL is already loaded.
      if (videoId !== lastVideoId) {
        lastVideoId = videoId;
        resetState();
      }
      // Populate meta as soon as YouTube's player state matches the URL.
      const m = extractVideoMeta();
      if (m && m.videoId === videoId) {
        setMeta(m);
      }
    };
    check();
    const interval = setInterval(check, 300);
    window.addEventListener("yt-navigate-finish", check);
    return () => {
      clearInterval(interval);
      window.removeEventListener("yt-navigate-finish", check);
    };
  }, []);

  useEffect(() => {
    sendMessage<MeResponse>({ type: "ME" })
      .then(setMe)
      .catch(() => setMe(null));
  }, [meta?.videoId]);

  // Pre-flight cache lookup: if this video+language is already in
  // processed_videos (because the same user, or anyone else, already
  // summarised it), surface it instantly. Also rehydrates the transcript so
  // the Transcript tab works on videos the worker processed via Whisper
  // (no YouTube captions available client-side).
  useEffect(() => {
    if (!meta?.videoId) return;
    const lang = me?.user?.preferredLanguage ?? "en";
    let cancelled = false;
    sendMessage<StatusResponse>({
      type: "STATUS",
      payload: { videoId: meta.videoId, language: lang },
    })
      .then((res) => {
        if (cancelled) return;
        if (res.status === "completed" && res.summary) {
          setSummary({
            summary: res.summary,
            language: res.language,
            sourceLanguage: res.sourceLanguage,
            cached: true,
            audioUrl: res.audioUrl,
          });
        }
        if (res.transcript) {
          setTranscript((prev) =>
            prev ?? {
              text: res.transcript as string,
              timedLines: [],
              languageCode: res.sourceLanguage ?? res.language,
              auto: true,
            },
          );
          setTranscriptError(null);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [meta?.videoId, me?.user?.preferredLanguage]);

  useEffect(() => {
    if (!meta) return;
    const preferredLang = me?.user?.preferredLanguage ?? "en";
    const track = pickBestCaptionTrack(meta.captions, preferredLang);
    if (!track) {
      setTranscriptError("no_captions");
      return;
    }
    fetchTranscript(track)
      .then((t) => setTranscript(t))
      .catch((err: Error) => {
        setTranscriptError(err.message);
      });
  }, [meta, me?.user?.preferredLanguage]);

  const onRequestSummary = useCallback(async () => {
    if (!meta || !transcript) return;
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const res = await sendMessage<SummarizeResponse>({
        type: "SUMMARIZE",
        payload: {
          videoId: meta.videoId,
          videoTitle: meta.videoTitle,
          channelId: meta.channelId,
          channelName: meta.channelName,
          transcript: transcript.text,
          sourceLanguage: transcript.languageCode,
          targetLanguage: me?.user?.preferredLanguage,
          videoDurationSec: meta.durationSec,
        },
      });
      setSummary(res);
      sendMessage<MeResponse>({ type: "ME" })
        .then(setMe)
        .catch(() => undefined);
    } catch (err) {
      setSummaryError(
        err instanceof Error ? err.message : "Summarization failed",
      );
    } finally {
      setSummaryLoading(false);
    }
  }, [meta, transcript, me?.user?.preferredLanguage]);

  const onEnqueueWorker = useCallback(async () => {
    if (!meta) return;
    // The /enqueue endpoint requires auth because Whisper costs money per run.
    // Surface that up-front rather than firing a request that 401s silently.
    if (!me?.authenticated) {
      setSummaryError(
        "Sign in to summarize videos without captions (free, takes 10 seconds).",
      );
      return;
    }
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      await sendMessage<{ ok: boolean; language: string }>({
        type: "ENQUEUE",
        payload: {
          videoId: meta.videoId,
          videoTitle: meta.videoTitle,
          channelId: meta.channelId,
          targetLanguage: me?.user?.preferredLanguage,
        },
      });
      const lang = me?.user?.preferredLanguage ?? "en";
      const pollStart = Date.now();
      const timer = setInterval(async () => {
        try {
          const res = await sendMessage<{
            status: string;
            summary: string | null;
            language: string;
            sourceLanguage: string | null;
            audioUrl: string | null;
          }>({
            type: "STATUS",
            payload: { videoId: meta.videoId, language: lang },
          });
          if (res.status === "completed" && res.summary) {
            setSummary({
              summary: res.summary,
              language: res.language,
              sourceLanguage: res.sourceLanguage,
              cached: false,
              audioUrl: res.audioUrl,
            });
            setSummaryLoading(false);
            clearInterval(timer);
          } else if (res.status === "failed") {
            setSummaryError("Processing failed. Please retry.");
            setSummaryLoading(false);
            clearInterval(timer);
          } else if (Date.now() - pollStart > 5 * 60 * 1000) {
            setSummaryError("Still processing. Check back later.");
            setSummaryLoading(false);
            clearInterval(timer);
          }
        } catch {
          // swallow poll errors
        }
      }, 3000);
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : "Enqueue failed");
      setSummaryLoading(false);
    }
  }, [meta, me?.user?.preferredLanguage]);

  const onSignIn = useCallback(async () => {
    await sendMessage({ type: "SIGN_IN" });
  }, []);

  const onSignOut = useCallback(async () => {
    await sendMessage({ type: "SIGN_OUT" });
    // Refresh /me so the UI drops back to anonymous immediately.
    sendMessage<MeResponse>({ type: "ME" })
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  const onLanguageChange = useCallback(
    (lang: string) => {
      // Optimistically update me so every downstream effect re-fires with the
      // new language (transcript pick, cache lookup, summarize request…).
      setMe((prev) =>
        prev && prev.user
          ? { ...prev, user: { ...prev.user, preferredLanguage: lang } }
          : prev,
      );
      // Clear the current summary so the auto-request kicks in again.
      setSummary(null);
      setSummaryError(null);
      // Persist locally — a future refactor can push this to profile.preferred_language.
      try {
        void chrome.storage.local.set({ brieftube_lang_override: lang });
      } catch {
        // ignore
      }
    },
    [],
  );

  const onSubscribeChannel = useCallback(async () => {
    if (!meta || !meta.channelId) return;
    setSubscribed("pending");
    try {
      await sendMessage<{ ok: boolean; alreadySubscribed: boolean }>({
        type: "SUBSCRIBE_CHANNEL",
        payload: {
          channelId: meta.channelId,
          channelName: meta.channelName,
          channelAvatarUrl: getChannelAvatar() ?? undefined,
        },
      });
      setSubscribed("done");
    } catch {
      setSubscribed("error");
    }
  }, [meta]);

  if (!meta) return null;

  return (
    <Sidebar
      meta={meta}
      transcript={transcript}
      transcriptError={transcriptError}
      me={me}
      summary={summary}
      summaryLoading={summaryLoading}
      summaryError={summaryError}
      onRequestSummary={onRequestSummary}
      onEnqueueWorker={onEnqueueWorker}
      onSignIn={onSignIn}
      onSignOut={onSignOut}
      onSubscribeChannel={onSubscribeChannel}
      onLanguageChange={onLanguageChange}
      subscribed={subscribed}
    />
  );
}

/**
 * Pattern-match the DOM for competing summary extensions so we can insert our
 * panel directly before theirs. This beats any "prepend to #secondary-inner"
 * race: we don't care where they inject, we just sit above them in the tree.
 */
const COMPETITOR_SELECTOR = [
  '[id*="eightify" i]',
  '[class*="eightify" i]',
  '[id*="glasp" i]',
  '[class*="glasp" i]',
  '[id*="notegpt" i]',
  '[class*="notegpt" i]',
  '[id*="yt-summarizer" i]',
  '[class*="yt-summarizer" i]',
  '[id*="harpa" i]',
  '[class*="harpa" i]',
  '[id*="summari" i]:not(#brieftube-sidebar-host)',
  '[class*="summari" i]:not(#brieftube-sidebar-host)',
].join(",");

function findCompetitorRoot(): HTMLElement | null {
  const scope = document.querySelector("ytd-watch-flexy") ?? document.body;
  const matches = scope.querySelectorAll<HTMLElement>(COMPETITOR_SELECTOR);
  for (const el of matches) {
    if (el.id === SIDEBAR_HOST_ID) continue;
    // Walk up to the topmost matching ancestor (root of the competitor panel)
    const ancestor = el.parentElement?.closest(COMPETITOR_SELECTOR);
    if (!ancestor || ancestor.id === SIDEBAR_HOST_ID) return el;
  }
  return null;
}

/**
 * Fallback injection target when no competitor is detected. `#secondary`
 * rather than `#secondary-inner` so that when a competitor *does* appear
 * later and injects into `#secondary-inner`, we're still above it.
 */
function findInjectionTarget(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>("#secondary") ??
    document.querySelector<HTMLElement>("#secondary-inner") ??
    document.querySelector<HTMLElement>(
      "ytd-watch-next-secondary-results-renderer",
    )
  );
}

function isWatchPage(): boolean {
  return (
    /youtube\.com\/watch/.test(window.location.href) &&
    new URL(window.location.href).searchParams.has("v")
  );
}

let reactRoot: Root | null = null;

type Theme = "dark" | "light";

/**
 * YouTube tracks its own theme by toggling a `dark` attribute on <html>.
 * Match it so the sidebar flips automatically — no user setting required.
 */
function detectYouTubeTheme(): Theme {
  return document.documentElement.hasAttribute("dark") ? "dark" : "light";
}

function applyHostStyle(host: HTMLElement, theme: Theme) {
  const shadow =
    theme === "dark"
      ? "0 0 0 1px rgba(255,255,255,0.08), 0 20px 40px -12px rgba(0,0,0,0.55)"
      : "0 0 0 1px rgba(0,0,0,0.08), 0 8px 24px -8px rgba(0,0,0,0.15)";
  host.style.cssText = [
    "display: block",
    "width: 100%",
    "margin: 0 0 16px 0",
    "contain: layout style",
    "border-radius: 12px",
    "overflow: hidden",
    `box-shadow: ${shadow}`,
    "isolation: isolate",
  ].join("; ");
  host.setAttribute("data-theme", theme);
}

// Watch <html dark> attribute and relay to every mounted host.
const themeObserver = new MutationObserver(() => {
  const host = document.getElementById(SIDEBAR_HOST_ID);
  if (host) applyHostStyle(host, detectYouTubeTheme());
});
themeObserver.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["dark"],
});

function buildHost(): HTMLElement {
  const host = document.createElement("div");
  host.id = SIDEBAR_HOST_ID;
  applyHostStyle(host, detectYouTubeTheme());
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = globalsCss;
  shadow.appendChild(style);
  const container = document.createElement("div");
  shadow.appendChild(container);
  reactRoot = createRoot(container);
  reactRoot.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  return host;
}

/**
 * Force our host visually above every competing summary extension even when
 * we're already first in the DOM. Competitors like Eightify use CSS (flex
 * order, transform, or negative margin) to pull themselves above us despite
 * being later in the tree. We counter with inline styles + `!important`,
 * which beat stylesheet rules in CSS specificity.
 *
 * Strategy:
 *   1. Turn #secondary into a flex column so `order` actually takes effect.
 *   2. Pin our host to the lowest possible order value (first).
 *   3. Pin every detected competitor to the highest order value (last).
 *   4. Strip any transform/margin/position tricks from competitors.
 */
const COMPETITOR_INLINE_SELECTOR = [
  "#eightify-block-embedded",
  "#eightify-iframe",
  '[id^="eightify" i]',
  '[class*="eightify" i]',
  '[id*="glasp" i]',
  '[class*="glasp" i]',
  '[id*="notegpt" i]',
  '[class*="notegpt" i]',
  '[id*="harpa" i]',
  '[class*="harpa" i]',
  '[id*="summari" i]:not(#brieftube-sidebar-host)',
  '[class*="summari" i]:not(#brieftube-sidebar-host)',
].join(",");

function enforceVisualOrder() {
  const secondary = document.querySelector<HTMLElement>("#secondary");
  if (secondary) {
    secondary.style.setProperty("display", "flex", "important");
    secondary.style.setProperty("flex-direction", "column", "important");
  }

  const ourHost = document.getElementById(SIDEBAR_HOST_ID);
  if (ourHost) {
    ourHost.style.setProperty("order", "-2147483648", "important");
    ourHost.style.setProperty("transform", "none", "important");
    ourHost.style.setProperty("margin-top", "0", "important");
    ourHost.style.setProperty("position", "relative", "important");
    ourHost.style.setProperty("top", "auto", "important");
  }

  const competitors = document.querySelectorAll<HTMLElement>(
    COMPETITOR_INLINE_SELECTOR,
  );
  competitors.forEach((el) => {
    if (el.id === SIDEBAR_HOST_ID) return;
    el.style.setProperty("order", "2147483647", "important");
    el.style.setProperty("transform", "none", "important");
    el.style.setProperty("margin-top", "0", "important");
    el.style.setProperty("position", "relative", "important");
    el.style.setProperty("top", "auto", "important");
  });
}

/**
 * Mount or re-mount the sidebar. Strategy:
 *  1. If a known competitor is already in the DOM, insert our host directly
 *     BEFORE it (insertBefore) — guarantees we're above them no matter which
 *     container they chose.
 *  2. Otherwise, prepend into `#secondary` so we're at the top of the right
 *     rail. If a competitor mounts later, the mutation observer triggers this
 *     function again and strategy 1 takes over.
 */
function ensureMounted(): boolean {
  if (!isWatchPage()) return false;

  let host = document.getElementById(SIDEBAR_HOST_ID);
  if (!host) host = buildHost();

  const competitor = findCompetitorRoot();
  if (competitor?.parentNode) {
    if (competitor.previousElementSibling !== host) {
      competitor.parentNode.insertBefore(host, competitor);
    }
    // Host now sits directly before the competitor. Enforce CSS too.
    enforceVisualOrder();
    return true;
  }

  const target = findInjectionTarget();
  if (!target) return false;

  if (!target.contains(host) || target.firstElementChild !== host) {
    target.prepend(host);
  }
  enforceVisualOrder();
  return true;
}

// Debounce with a microtask rather than requestAnimationFrame. Microtasks run
// before the next paint, so if a competitor extension also uses RAF to reorder
// themselves, our microtask fires first and wins the frame.
let scheduled = false;
function scheduleEnsure() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    ensureMounted();
  });
}

// Global observer — catches any DOM change, including competitor extensions
// mounting minutes after page load.
const globalObserver = new MutationObserver(scheduleEnsure);
globalObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

scheduleEnsure();
window.addEventListener("yt-navigate-finish", scheduleEnsure);
window.addEventListener("popstate", scheduleEnsure);

// Aggressive poll — every 150 ms. The check is three DOM lookups and one
// comparison, so the cost is negligible. This guarantees we reclaim position
// within one frame of a competitor pushing us down.
setInterval(scheduleEnsure, 150);
