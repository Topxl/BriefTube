import { useEffect, useRef, useState } from "react";
import {
  AlignLeft,
  BookmarkPlus,
  Check,
  ChevronDown,
  Copy,
  CreditCard,
  ExternalLink,
  FileText,
  Headphones,
  LayoutDashboard,
  Loader2,
  Lock,
  LogOut,
  Play,
  Sparkles,
} from "lucide-react";
import { clsx } from "clsx";
import type { ExtractedTranscript, VideoMeta } from "./transcript";
import { seekTo } from "./transcript";
import type { MeResponse, SummarizeResponse } from "@/lib/types";
import logoUrl from "../../public/icons/icon-128.png";

type Props = {
  meta: VideoMeta;
  transcript: ExtractedTranscript | null;
  transcriptError: string | null;
  me: MeResponse | null;
  summary: SummarizeResponse | null;
  summaryLoading: boolean;
  summaryError: string | null;
  statusCheckPending: boolean;
  onRequestSummary: () => void;
  onEnqueueWorker: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onSubscribeChannel: () => void;
  onLanguageChange: (lang: string) => void;
  subscribed: "idle" | "pending" | "done" | "error";
};

// Mirrors src/lib/languages.ts from the main app. Keep in sync when adding
// new voices on the web side — otherwise the extension picker exposes
// languages the worker/summarizer doesn't support.
const LANGUAGE_OPTIONS: { code: string; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
  { code: "nl", label: "Nederlands", flag: "🇳🇱" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
  { code: "uk", label: "Українська", flag: "🇺🇦" },
  { code: "pl", label: "Polski", flag: "🇵🇱" },
  { code: "cs", label: "Čeština", flag: "🇨🇿" },
  { code: "sk", label: "Slovenčina", flag: "🇸🇰" },
  { code: "sl", label: "Slovenščina", flag: "🇸🇮" },
  { code: "hr", label: "Hrvatski", flag: "🇭🇷" },
  { code: "sr", label: "Српски", flag: "🇷🇸" },
  { code: "bg", label: "Български", flag: "🇧🇬" },
  { code: "ro", label: "Română", flag: "🇷🇴" },
  { code: "hu", label: "Magyar", flag: "🇭🇺" },
  { code: "el", label: "Ελληνικά", flag: "🇬🇷" },
  { code: "sv", label: "Svenska", flag: "🇸🇪" },
  { code: "nb", label: "Norsk", flag: "🇳🇴" },
  { code: "da", label: "Dansk", flag: "🇩🇰" },
  { code: "fi", label: "Suomi", flag: "🇫🇮" },
  { code: "et", label: "Eesti", flag: "🇪🇪" },
  { code: "lv", label: "Latviešu", flag: "🇱🇻" },
  { code: "lt", label: "Lietuvių", flag: "🇱🇹" },
  { code: "ca", label: "Català", flag: "🇪🇸" },
  { code: "tr", label: "Türkçe", flag: "🇹🇷" },
  { code: "az", label: "Azərbaycan", flag: "🇦🇿" },
  { code: "ka", label: "ქართული", flag: "🇬🇪" },
  { code: "kk", label: "Қазақ", flag: "🇰🇿" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
  { code: "he", label: "עברית", flag: "🇮🇱" },
  { code: "fa", label: "فارسی", flag: "🇮🇷" },
  { code: "ur", label: "اردو", flag: "🇵🇰" },
  { code: "hi", label: "हिन्दी", flag: "🇮🇳" },
  { code: "bn", label: "বাংলা", flag: "🇧🇩" },
  { code: "ta", label: "தமிழ்", flag: "🇮🇳" },
  { code: "te", label: "తెలుగు", flag: "🇮🇳" },
  { code: "kn", label: "ಕನ್ನಡ", flag: "🇮🇳" },
  { code: "ml", label: "മലയാളം", flag: "🇮🇳" },
  { code: "gu", label: "ગુજરાતી", flag: "🇮🇳" },
  { code: "mr", label: "मराठी", flag: "🇮🇳" },
  { code: "pa", label: "ਪੰਜਾਬੀ", flag: "🇮🇳" },
  { code: "ne", label: "नेपाली", flag: "🇳🇵" },
  { code: "th", label: "ภาษาไทย", flag: "🇹🇭" },
  { code: "vi", label: "Tiếng Việt", flag: "🇻🇳" },
  { code: "id", label: "Indonesia", flag: "🇮🇩" },
  { code: "ms", label: "Melayu", flag: "🇲🇾" },
  { code: "fil", label: "Filipino", flag: "🇵🇭" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "ko", label: "한국어", flag: "🇰🇷" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "sw", label: "Kiswahili", flag: "🇰🇪" },
  { code: "am", label: "አማርኛ", flag: "🇪🇹" },
];

type Tab = "summary" | "chapters" | "audio" | "transcript";

const TABS: { id: Tab; label: string; icon: typeof FileText; pro: boolean }[] =
  [
    { id: "summary", label: "Summary", icon: FileText, pro: false },
    { id: "chapters", label: "Chapters", icon: Play, pro: false },
    { id: "audio", label: "Audio", icon: Headphones, pro: true },
    { id: "transcript", label: "Transcript", icon: AlignLeft, pro: false },
  ];

function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function chunkTranscriptToChapters(
  lines: { start: number; text: string }[],
  targetCount: number,
) {
  if (lines.length === 0 || targetCount <= 1) {
    return lines.length > 0
      ? [{ start: lines[0].start, preview: lines[0].text.slice(0, 120) }]
      : [];
  }
  const step = Math.max(1, Math.floor(lines.length / targetCount));
  const result: { start: number; preview: string }[] = [];
  for (let i = 0; i < lines.length; i += step) {
    const sliceText = lines
      .slice(i, i + step)
      .map((l) => l.text)
      .join(" ");
    result.push({ start: lines[i].start, preview: sliceText.slice(0, 140) });
  }
  return result.slice(0, targetCount);
}

export function Sidebar(props: Props) {
  const {
    meta,
    transcript,
    transcriptError,
    me,
    summary,
    summaryLoading,
    summaryError,
    statusCheckPending,
    onRequestSummary,
    onEnqueueWorker,
    onSignIn,
    onSignOut,
    onSubscribeChannel,
    onLanguageChange,
    subscribed,
  } = props;
  const [activeTab, setActiveTab] = useState<Tab>("summary");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuAnchorRef = useRef<HTMLDivElement>(null);
  const autoRequestedRef = useRef<string | null>(null);

  // Close the account menu on any click outside both the avatar button and
  // the dropdown itself. Uses composedPath so it works across shadow DOM.
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      const anchor = menuAnchorRef.current;
      if (!anchor) return;
      if (!e.composedPath().includes(anchor)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const isPro = !!me?.quota.isPro;
  const authenticated = !!me?.authenticated;
  const quotaRemaining = me?.quota.remaining ?? null;
  const quotaLimit = me?.quota.limit ?? null;
  const canSummarize =
    quotaRemaining === null || quotaRemaining > 0 || isPro || !!summary;

  // Track which videoId we've already auto-requested so we don't fire again on
  // the same video, but DO re-fire when the user switches videos.
  useEffect(() => {
    if (
      transcript &&
      !summary &&
      canSummarize &&
      autoRequestedRef.current !== meta.videoId
    ) {
      autoRequestedRef.current = meta.videoId;
      onRequestSummary();
    }
  }, [meta.videoId, transcript, summary, canSummarize, onRequestSummary]);

  const chapters = transcript
    ? chunkTranscriptToChapters(
        transcript.timedLines,
        Math.max(3, Math.min(12, Math.round(meta.durationSec / 180))),
      )
    : [];

  return (
    <div
      className="brieftube-root flex w-full flex-col bg-[var(--bt-bg)] text-[var(--bt-text)]"
      style={{ fontFamily: "inherit" }}
    >
      <header className="flex items-center gap-3 border-b border-[var(--bt-border)] bg-[var(--bt-bg-elevated)] px-4 py-3">
        <img
          src={logoUrl}
          alt="BriefTube"
          className="size-8 shrink-0 rounded-lg"
        />

        {!authenticated ? (
          <>
            <span className="flex-1 truncate text-[12px] text-[var(--bt-text-soft)]">
              <span className="font-semibold text-[var(--bt-text)]">
                {quotaRemaining ?? 3} free
              </span>{" "}
              summaries left today
            </span>
            <button
              onClick={onSignIn}
              className="bg-brand hover:bg-brand-dark rounded-full px-3 py-1.5 text-[11px] font-semibold text-white transition"
            >
              Sign in for more
            </button>
          </>
        ) : (
          <>
            {isPro ? (
              <span className="flex-1 truncate text-[12px] font-medium text-emerald-300">
                Pro: unlimited summaries
              </span>
            ) : (
              <span className="flex-1 truncate text-[12px] text-[var(--bt-text-soft)]">
                <span className="font-semibold text-[var(--bt-text)]">
                  {quotaRemaining ?? "?"}/{quotaLimit ?? "?"}
                </span>{" "}
                summaries today
              </span>
            )}
            <div ref={menuAnchorRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Account menu"
                className="block shrink-0 rounded-full ring-1 ring-[var(--bt-border)] transition hover:ring-[var(--bt-text-muted)]"
              >
                {me?.user?.avatarUrl ? (
                  <img
                    src={me.user.avatarUrl}
                    alt={me.user.email ?? "Account"}
                    referrerPolicy="no-referrer"
                    className="block size-7 rounded-full"
                  />
                ) : (
                  <div
                    title={me?.user?.email ?? "Account"}
                    className="flex size-7 items-center justify-center rounded-full bg-[var(--bt-bg)] text-[11px] font-semibold text-[var(--bt-text-soft)]"
                  >
                    {(me?.user?.email ?? "U").charAt(0).toUpperCase()}
                  </div>
                )}
              </button>
              {menuOpen ? (
                <UserMenu
                  email={me?.user?.email ?? ""}
                  avatarUrl={me?.user?.avatarUrl ?? null}
                  currentLang={me?.user?.preferredLanguage ?? "en"}
                  onLanguageChange={(lang) => {
                    onLanguageChange(lang);
                    setMenuOpen(false);
                  }}
                  onSignOut={() => {
                    onSignOut();
                    setMenuOpen(false);
                  }}
                />
              ) : null}
            </div>
          </>
        )}
      </header>

      <nav className="flex border-b border-[var(--bt-border)] bg-[var(--bt-bg-elevated)]">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const locked = tab.pro && !isPro;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              disabled={locked}
              className={clsx(
                "group relative flex flex-1 items-center justify-center gap-1.5 py-3 text-[12px] font-semibold transition",
                activeTab === tab.id
                  ? "text-[var(--bt-text)]"
                  : "text-[var(--bt-text-muted)] hover:text-[var(--bt-text-soft)]",
                locked && "cursor-not-allowed",
              )}
              title={locked ? "Pro feature" : undefined}
            >
              <Icon className="size-[15px]" />
              <span>{tab.label}</span>
              {locked ? (
                <Lock className="size-3 text-[var(--bt-text-dim)]" />
              ) : null}
              {activeTab === tab.id ? (
                <span className="bg-brand absolute inset-x-3 bottom-0 h-[3px] rounded-t-full" />
              ) : null}
            </button>
          );
        })}
      </nav>

      <section className="brieftube-scroll max-h-[65vh] flex-1 overflow-y-auto px-4 py-4 text-[14px] leading-relaxed">
        {activeTab === "summary" ? (
          <SummaryPanel
            summary={summary}
            loading={summaryLoading}
            error={summaryError}
            transcriptError={transcriptError}
            statusCheckPending={statusCheckPending}
            canSummarize={canSummarize}
            onRequestSummary={onRequestSummary}
            onEnqueueWorker={onEnqueueWorker}
          />
        ) : null}
        {activeTab === "chapters" ? (
          <ChaptersPanel chapters={chapters} />
        ) : null}
        {activeTab === "audio" ? (
          <AudioPanel
            summary={summary}
            isPro={isPro}
            authenticated={authenticated}
            channelName={meta.channelName}
            onSubscribeChannel={onSubscribeChannel}
            subscribed={subscribed}
            onSignIn={onSignIn}
          />
        ) : null}
        {activeTab === "transcript" ? (
          <TranscriptPanel
            transcript={transcript}
            transcriptError={transcriptError}
            statusCheckPending={statusCheckPending}
            loading={summaryLoading}
            onEnqueueWorker={onEnqueueWorker}
          />
        ) : null}
      </section>

      <footer className="flex flex-col gap-2.5 border-t border-[var(--bt-border)] bg-[var(--bt-bg-elevated)] px-4 py-3">
        <button
          onClick={onSubscribeChannel}
          disabled={!authenticated || subscribed === "pending"}
          className={clsx(
            "flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition",
            subscribed === "done"
              ? "bg-emerald-500/15 text-emerald-300"
              : authenticated
                ? "bg-brand hover:bg-brand-dark text-white shadow-lg shadow-brand/20"
                : "cursor-not-allowed bg-[var(--bt-hover-bg)] text-[var(--bt-text-dim)]",
          )}
          title={
            authenticated
              ? "Get auto-summaries of new videos on Telegram, Discord or email."
              : "Sign in to subscribe"
          }
        >
          {subscribed === "done" ? (
            <>
              <Check className="size-4" />
              Subscribed to auto-summaries
            </>
          ) : (
            <>
              <BookmarkPlus className="size-4" />
              Subscribe to {meta.channelName || "this channel"}
            </>
          )}
        </button>

      </footer>
    </div>
  );
}

function LanguagePicker(props: {
  currentLang: string;
  onLanguageChange: (lang: string) => void;
}) {
  const { currentLang, onLanguageChange } = props;
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const current =
    LANGUAGE_OPTIONS.find((l) => l.code === currentLang) ?? LANGUAGE_OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      if (!e.composedPath().includes(anchor)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={anchorRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-lg border border-[var(--bt-border)] bg-[var(--bt-bg)] px-2.5 py-2 text-left text-[12px] font-medium text-[var(--bt-text)] transition hover:border-[var(--bt-text-muted)] hover:bg-[var(--bt-hover-bg)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bt-text-muted)]"
      >
        <span className="text-[15px] leading-none">{current.flag}</span>
        <span className="flex-1 truncate">{current.label}</span>
        <ChevronDown
          className={clsx(
            "size-3.5 text-[var(--bt-text-muted)] transition",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          className="brieftube-scroll absolute left-0 right-0 top-[calc(100%+4px)] z-10 max-h-[240px] overflow-y-auto rounded-lg border border-[var(--bt-border)] bg-[var(--bt-bg)] py-1 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.4)]"
        >
          {LANGUAGE_OPTIONS.map((l) => {
            const selected = l.code === currentLang;
            return (
              <button
                key={l.code}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onLanguageChange(l.code);
                  setOpen(false);
                }}
                className={clsx(
                  "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] transition",
                  selected
                    ? "bg-[var(--bt-hover-bg-strong)] font-semibold text-[var(--bt-text)]"
                    : "text-[var(--bt-text-soft)] hover:bg-[var(--bt-hover-bg)] hover:text-[var(--bt-text)]",
                )}
              >
                <span className="text-[15px] leading-none">{l.flag}</span>
                <span className="flex-1 truncate">{l.label}</span>
                {selected ? <Check className="text-brand size-3.5" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function UserMenu(props: {
  email: string;
  avatarUrl: string | null;
  currentLang: string;
  onLanguageChange: (lang: string) => void;
  onSignOut: () => void;
}) {
  const { email, avatarUrl, currentLang, onLanguageChange, onSignOut } = props;
  return (
    <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[260px] overflow-hidden rounded-xl bg-[var(--bt-bg-elevated)] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6),0_0_0_1px_var(--bt-border)]">
      <div className="flex items-center gap-2.5 border-b border-[var(--bt-border)] px-3 py-3">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="size-8 shrink-0 rounded-full"
          />
        ) : (
          <div className="bg-brand flex size-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white">
            {(email || "U").charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-semibold text-[var(--bt-text)]">
            {email || "Signed in"}
          </div>
          <div className="text-[10px] text-[var(--bt-text-muted)]">
            BriefTube account
          </div>
        </div>
      </div>

      <div className="border-b border-[var(--bt-border)] px-3 py-2.5">
        <div className="mb-1.5 text-[10px] font-semibold tracking-wider text-[var(--bt-text-dim)] uppercase">
          Summary language
        </div>
        <LanguagePicker
          currentLang={currentLang}
          onLanguageChange={onLanguageChange}
        />
      </div>

      <a
        href="https://www.brief-tube.com/dashboard"
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2.5 px-3 py-2.5 text-[12px] font-medium text-[var(--bt-text-soft)] transition hover:bg-[var(--bt-hover-bg)] hover:text-[var(--bt-text)]"
      >
        <LayoutDashboard className="size-4" />
        <span className="flex-1">Open dashboard</span>
        <ExternalLink className="size-3 text-[var(--bt-text-dim)]" />
      </a>
      <a
        href="https://www.brief-tube.com/dashboard/billing"
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2.5 border-b border-[var(--bt-border)] px-3 py-2.5 text-[12px] font-medium text-[var(--bt-text-soft)] transition hover:bg-[var(--bt-hover-bg)] hover:text-[var(--bt-text)]"
      >
        <CreditCard className="size-4" />
        <span className="flex-1">Manage subscription</span>
        <ExternalLink className="size-3 text-[var(--bt-text-dim)]" />
      </a>

      <button
        type="button"
        onClick={onSignOut}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-[12px] font-medium text-[var(--bt-text-muted)] transition hover:bg-[var(--bt-hover-bg)] hover:text-[var(--bt-text)]"
      >
        <LogOut className="size-4" />
        Sign out
      </button>
    </div>
  );
}

function SummaryPanel(props: {
  summary: SummarizeResponse | null;
  loading: boolean;
  error: string | null;
  transcriptError: string | null;
  statusCheckPending: boolean;
  canSummarize: boolean;
  onRequestSummary: () => void;
  onEnqueueWorker: () => void;
}) {
  const {
    summary,
    loading,
    error,
    transcriptError,
    statusCheckPending,
    canSummarize,
    onRequestSummary,
    onEnqueueWorker,
  } = props;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-brand size-6 animate-spin" />
      </div>
    );
  }

  // Don't show "No captions" prematurely while we're still checking if a
  // cached summary exists — the pre-flight /status call often surfaces a
  // ready-to-go summary within ~300 ms, and flashing the Whisper CTA
  // beforehand makes users think the extension is broken.
  if (statusCheckPending && !summary) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-brand size-6 animate-spin" />
      </div>
    );
  }

  if (transcriptError && !summary) {
    return (
      <div className="flex flex-col gap-4 py-4 text-center">
        <div className="flex flex-col gap-1">
          <p className="text-[14px] font-semibold text-[var(--bt-text)]">
            No captions on this video
          </p>
          <p className="text-[12px] text-[var(--bt-text-muted)]">
            We'll transcribe the audio with Whisper (1-2 min) and summarize it
            for you.
          </p>
        </div>
        <button
          onClick={onEnqueueWorker}
          className="bg-brand hover:bg-brand-dark flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-[14px] font-semibold text-[var(--bt-text)] transition"
        >
          <Sparkles className="size-4" />
          Transcribe &amp; summarize
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <p className="text-[13px] text-red-300">{error}</p>
        {canSummarize ? (
          <button
            onClick={onRequestSummary}
            className="bg-brand hover:bg-brand-dark rounded-xl px-4 py-2 text-[13px] font-semibold text-[var(--bt-text)] transition"
          >
            Retry
          </button>
        ) : null}
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-brand/15">
          <Sparkles className="text-brand size-6" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-[14px] font-semibold text-[var(--bt-text)]">
            Ready when you are
          </p>
          <p className="text-[12px] text-[var(--bt-text-muted)]">
            One click to get the key points.
          </p>
        </div>
        <button
          onClick={onRequestSummary}
          disabled={!canSummarize}
          className={clsx(
            "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-[14px] font-semibold text-[var(--bt-text)] transition",
            canSummarize
              ? "bg-brand hover:bg-brand-dark shadow-lg shadow-brand/20"
              : "cursor-not-allowed bg-[var(--bt-hover-bg-strong)]",
          )}
        >
          <Sparkles className="size-4" />
          Summarize this video
        </button>
      </div>
    );
  }

  return (
    <article className="flex flex-col gap-3">
      {summary.summary.split(/\n\n+/).map((para, i) => (
        <p key={i} className="text-[14px] leading-relaxed text-[var(--bt-text-soft)]">
          {para}
        </p>
      ))}
    </article>
  );
}

function ChaptersPanel(props: {
  chapters: { start: number; preview: string }[];
}) {
  const { chapters } = props;
  if (chapters.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <Play className="size-6 text-[var(--bt-text-faint)]" />
        <p className="text-[13px] font-medium text-[var(--bt-text-muted)]">
          Summarize first
        </p>
        <p className="text-[11px] text-[var(--bt-text-dim)]">
          Chapters appear once we have the transcript.
        </p>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-1">
      {chapters.map((ch, i) => (
        <li key={i}>
          <button
            onClick={() => seekTo(ch.start)}
            className="group flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-[var(--bt-hover-bg)]"
          >
            <span className="group-hover:bg-brand mt-0.5 shrink-0 rounded-md bg-[var(--bt-hover-bg-strong)] px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--bt-text-soft)] transition group-hover:text-white">
              {formatTime(ch.start)}
            </span>
            <span className="flex-1 text-[12px] leading-snug text-[var(--bt-text-soft)]">
              {ch.preview}…
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function TranscriptPanel(props: {
  transcript: ExtractedTranscript | null;
  transcriptError: string | null;
  statusCheckPending: boolean;
  loading: boolean;
  onEnqueueWorker: () => void;
}) {
  const {
    transcript,
    transcriptError,
    statusCheckPending,
    loading,
    onEnqueueWorker,
  } = props;
  const [copied, setCopied] = useState(false);

  // Match the SummaryPanel lifecycle: spinner while checking cache, loader
  // while Whisper is running, CTA only once we've confirmed nothing is
  // available.
  if (statusCheckPending && !transcript) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-brand size-6 animate-spin" />
      </div>
    );
  }

  if (loading && !transcript) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-brand size-6 animate-spin" />
      </div>
    );
  }

  if (transcriptError === "no_captions" && !transcript) {
    return (
      <div className="flex flex-col gap-4 py-4 text-center">
        <div className="flex flex-col gap-1">
          <p className="text-[14px] font-semibold text-[var(--bt-text)]">
            No captions on this video
          </p>
          <p className="text-[12px] text-[var(--bt-text-muted)]">
            We'll transcribe the audio with Whisper (1-2 min) and generate a
            summary so you get both here.
          </p>
        </div>
        <button
          onClick={onEnqueueWorker}
          className="bg-brand hover:bg-brand-dark flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-[14px] font-semibold text-[var(--bt-text)] transition"
        >
          <Sparkles className="size-4" />
          Transcribe &amp; summarize
        </button>
      </div>
    );
  }

  if (!transcript) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <AlignLeft className="size-6 text-[var(--bt-text-faint)]" />
        <p className="text-[13px] font-medium text-[var(--bt-text-muted)]">
          No transcript available
        </p>
      </div>
    );
  }

  // Plain-text transcript (no timestamps) comes from the server — our worker's
  // Whisper pipeline doesn't preserve per-line timings, so we render it as
  // paragraphs instead of clickable timecoded rows.
  const hasTimings = transcript.timedLines.length > 0;
  const plainText = hasTimings
    ? transcript.timedLines.map((l) => l.text).join(" ")
    : transcript.text;

  const copyText = () => {
    const text = hasTimings
      ? transcript.timedLines
          .map((l) => `${formatTime(l.start)} ${l.text}`)
          .join("\n")
      : plainText;
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between pb-1">
        <span className="text-[11px] font-medium text-[var(--bt-text-muted)]">
          {hasTimings
            ? transcript.auto
              ? "Auto-generated"
              : "Human captions"
            : "Whisper transcript"}{" "}
          · {transcript.languageCode.toUpperCase()}
        </span>
        <button
          onClick={copyText}
          className="flex items-center gap-1.5 rounded-md bg-[var(--bt-hover-bg)] px-2 py-1 text-[11px] font-medium text-[var(--bt-text-soft)] transition hover:bg-[var(--bt-hover-bg-strong)]"
          title="Copy full transcript"
        >
          {copied ? (
            <>
              <Check className="size-3" /> Copied
            </>
          ) : (
            <>
              <Copy className="size-3" /> Copy
            </>
          )}
        </button>
      </div>
      {hasTimings ? (
        <ul className="flex flex-col">
          {transcript.timedLines.map((line, i) => (
            <li key={i}>
              <button
                onClick={() => seekTo(line.start)}
                className="group flex w-full items-start gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-[var(--bt-hover-bg)]"
              >
                <span className="group-hover:bg-brand mt-0.5 shrink-0 rounded-md bg-[var(--bt-hover-bg-strong)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--bt-text-muted)] transition group-hover:text-white">
                  {formatTime(line.start)}
                </span>
                <span className="flex-1 text-[12px] leading-snug text-[var(--bt-text-soft)]">
                  {line.text}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col gap-2.5 pb-2">
          {plainText.split(/(?<=[.!?])\s+(?=[A-ZÀ-ÿ])/).map((para, i) => (
            <p
              key={i}
              className="text-[12px] leading-relaxed text-[var(--bt-text-soft)]"
            >
              {para}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function AudioPanel(props: {
  summary: SummarizeResponse | null;
  isPro: boolean;
  authenticated: boolean;
  channelName: string;
  onSubscribeChannel: () => void;
  subscribed: "idle" | "pending" | "done" | "error";
  onSignIn: () => void;
}) {
  const {
    summary,
    isPro,
    authenticated,
    channelName,
    onSubscribeChannel,
    subscribed,
    onSignIn,
  } = props;

  // Not authenticated → push sign-in
  if (!authenticated) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-brand/15">
          <Headphones className="text-brand size-6" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-[14px] font-semibold text-[var(--bt-text)]">
            Listen on the go
          </p>
          <p className="max-w-[260px] text-[12px] text-[var(--bt-text-muted)]">
            Turn any summary into a natural-voice audio track. Sign in to
            unlock.
          </p>
        </div>
        <button
          onClick={onSignIn}
          className="bg-brand hover:bg-brand-dark shadow-brand/20 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-semibold text-[var(--bt-text)] shadow-lg transition"
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  if (!isPro) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-brand/15">
          <Headphones className="text-brand size-6" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-[14px] font-semibold text-[var(--bt-text)]">
            Listen on the go
          </p>
          <p className="max-w-[260px] text-[12px] text-[var(--bt-text-muted)]">
            Turn any summary into natural-voice audio. Perfect for commutes
            and workouts.
          </p>
        </div>
        <a
          href="https://www.brief-tube.com/dashboard/billing"
          target="_blank"
          rel="noreferrer"
          className="bg-brand hover:bg-brand-dark shadow-brand/20 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-semibold text-[var(--bt-text)] shadow-lg transition"
        >
          <Sparkles className="size-3.5" /> Unlock with Pro
        </a>
      </div>
    );
  }

  // Pro + summary available → show player if audio exists
  if (summary?.audioUrl) {
    return (
      <audio
        controls
        src={summary.audioUrl}
        className="w-full"
        style={{ colorScheme: "dark" }}
      >
        Your browser does not support the audio element.
      </audio>
    );
  }

  // Pro but no audio (fast-path summary, worker never ran)
  if (!summary) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Headphones className="size-8 text-[var(--bt-text-faint)]" />
        <p className="text-[13px] font-medium text-[var(--bt-text-muted)]">
          Summarize first to unlock audio
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-brand/15">
        <Headphones className="text-brand size-6" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-[14px] font-semibold text-[var(--bt-text)]">
          Audio isn't ready yet
        </p>
        <p className="max-w-[260px] text-[12px] text-[var(--bt-text-muted)]">
          Subscribe to {channelName || "this channel"} and BriefTube will
          auto-generate natural-voice audio for every new upload, delivered
          straight to Telegram, Discord or email.
        </p>
      </div>
      <button
        onClick={onSubscribeChannel}
        disabled={subscribed === "pending" || subscribed === "done"}
        className={clsx(
          "inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-semibold text-[var(--bt-text)] transition",
          subscribed === "done"
            ? "bg-emerald-500/20 text-emerald-300"
            : "bg-brand hover:bg-brand-dark shadow-brand/20 shadow-lg disabled:opacity-60",
        )}
      >
        {subscribed === "done" ? (
          <>
            <Check className="size-3.5" /> Subscribed — next video gets audio
          </>
        ) : (
          <>
            <BookmarkPlus className="size-3.5" />
            Subscribe to get audio
          </>
        )}
      </button>
    </div>
  );
}

