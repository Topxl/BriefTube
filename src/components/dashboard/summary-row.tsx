"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import {
  ChevronDown,
  ExternalLink,
  FileText,
  Play,
  MoreHorizontal,
  RefreshCw,
  Share2,
  Languages,
  Star,
  Loader2,
  MessageSquareText,
  Plus,
} from "@/lib/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { t } from "@/locales";
import { toast } from "sonner";
import { useSummarizeVideo } from "@/hooks/use-summarize-video";
import { languages as LANGUAGES } from "@/lib/languages";
import { SiteConfig } from "@/site-config";
import { LanguagePicker } from "@/components/dashboard/language-picker";
import { dialogManager } from "@/features/dialog-manager/dialog-manager";

const tl = t.dashboard.summaries;

function formatSummaryDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const toDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(toDay.getTime() - 86400000);
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (d.getTime() === toDay.getTime()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (d.getTime() === yesterday.getTime()) return "Yesterday";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(2);
  return `${dd}/${mm}/${yy}`;
}

export type Delivery = {
  id: string;
  user_id: string;
  video_id: string;
  status: string | null;
  source: string | null;
  sent_at: string | null;
  created_at: string | null;
  language?: string;
};

export type ProcessedVideo = {
  video_id: string;
  video_title: string | null;
  video_url: string | null;
  summary: string | null;
  audio_url: string | null;
  channel_id: string;
  status: string | null;
};

export type EnrichedDelivery = Delivery & { video?: ProcessedVideo };

const SPEEDS = [1, 1.5, 2, 3] as const;
const SPEED_STORAGE_KEY = "briefTubePlaybackSpeed";

function getGlobalSpeed(): (typeof SPEEDS)[number] {
  if (typeof window === "undefined") return 1;
  const stored = localStorage.getItem(SPEED_STORAGE_KEY);
  if (stored) {
    const n = parseFloat(stored);
    if (SPEEDS.includes(n as (typeof SPEEDS)[number]))
      return n as (typeof SPEEDS)[number];
  }
  return 1;
}

function setGlobalSpeed(s: (typeof SPEEDS)[number]) {
  localStorage.setItem(SPEED_STORAGE_KEY, String(s));
  window.dispatchEvent(new CustomEvent("playbackSpeedChanged", { detail: s }));
}

const WAVEFORM_HEIGHTS = [0.5, 0.9, 0.65, 1, 0.55, 0.8, 0.4, 0.75, 0.6, 0.95];

function AudioWaveform() {
  return (
    <div
      className="flex items-center gap-[2px]"
      style={{ height: "14px", width: "22px" }}
    >
      {WAVEFORM_HEIGHTS.map((h, i) => (
        <div
          key={i}
          className="w-[2px] rounded-full bg-white"
          style={{
            height: `${h * 100}%`,
            animation: "waveform 0.7s ease-in-out infinite",
            animationDelay: `${i * 0.07}s`,
            transformOrigin: "center",
          }}
        />
      ))}
    </div>
  );
}

type SummaryLengthPref = "brief" | "standard" | "detailed";
type SummaryStylePref = "key_points" | "narrative" | "actionable";

const SUMMARY_LENGTH_OPTIONS: { value: SummaryLengthPref; label: string }[] = [
  { value: "brief", label: "Brief" },
  { value: "standard", label: "Standard" },
  { value: "detailed", label: "Detailed" },
];

const SUMMARY_STYLE_OPTIONS: { value: SummaryStylePref; label: string }[] = [
  { value: "key_points", label: "Key points" },
  { value: "narrative", label: "Narrative" },
  { value: "actionable", label: "Actionable" },
];

export function SummaryRow({
  delivery,
  resolvedTitle,
  favoriteLanguages = [],
  onManageFavorites: _onManageFavorites,
  onToggleFavorite,
  channelActive,
  onToggleChannel,
  channelAvatarUrl,
  summaryLengthPref,
  onSummaryLengthChange,
  summaryStylePref,
  onSummaryStyleChange,
  onSubscribeChannel,
}: {
  delivery: EnrichedDelivery;
  resolvedTitle?: string;
  favoriteLanguages?: string[];
  onManageFavorites?: () => void;
  onToggleFavorite?: (code: string) => void;
  channelActive?: boolean;
  onToggleChannel?: () => void;
  channelAvatarUrl?: string | null;
  summaryLengthPref?: SummaryLengthPref | null;
  onSummaryLengthChange?: (length: SummaryLengthPref | null) => void;
  summaryStylePref?: SummaryStylePref | null;
  onSummaryStyleChange?: (style: SummaryStylePref | null) => void;
  /** Called when user wants to subscribe to the channel (not yet subscribed) */
  onSubscribeChannel?: () => void;
}) {
  const video = delivery.video;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeedLocal] = useState<(typeof SPEEDS)[number]>(1);

  // Sync speed from localStorage on mount + listen for global changes
  useEffect(() => {
    setSpeedLocal(getGlobalSpeed());
    const handler = (e: Event) => {
      const s = (e as CustomEvent).detail as (typeof SPEEDS)[number];
      setSpeedLocal(s);
      if (audioRef.current) audioRef.current.playbackRate = s;
    };
    window.addEventListener("playbackSpeedChanged", handler);
    return () => window.removeEventListener("playbackSpeedChanged", handler);
  }, []);
  const [progress, setProgress] = useState(0);
  const [_duration, setDuration] = useState(0);
  const [_currentTime, setCurrentTime] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [isRead, setIsRead] = useState(false);

  // Restore read state from localStorage after mount (SSR-safe)
  useEffect(() => {
    if (localStorage.getItem(`read:${delivery.id}`)) {
      setIsRead(true);
    }
  }, [delivery.id]);

  const title = video?.video_title ?? resolvedTitle ?? null;
  const thumbnailUrl = `/api/thumbnail/${delivery.video_id}`;

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.playbackRate = speed;
      void audio.play();
      if (!isRead) {
        localStorage.setItem(`read:${delivery.id}`, "1");
        setIsRead(true);
      }
    }
    setPlaying(!playing);
  }, [playing, isRead, delivery.id, speed]);

  const changeSpeed = useCallback((s: (typeof SPEEDS)[number]) => {
    setSpeedLocal(s);
    setGlobalSpeed(s);
    if (audioRef.current) audioRef.current.playbackRate = s;
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio?.duration) return;
    setCurrentTime(audio.currentTime);
    setProgress((audio.currentTime / audio.duration) * 100);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (audio) setDuration(audio.duration);
  }, []);

  const handleEnded = useCallback(() => {
    setPlaying(false);
    setProgress(0);
    setCurrentTime(0);
  }, []);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio?.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    audio.currentTime = pct * audio.duration;
  }, []);

  const handleShare = useCallback(async () => {
    const url = `${SiteConfig.prodUrl}/videos/${delivery.video_id}`;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (navigator.share) {
      try {
        await navigator.share({ title: title ?? "BriefTube", url });
      } catch {
        // cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied!");
    }
  }, [title, delivery.video_id]);

  const [generatingLang, setGeneratingLang] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState<string | null>(null);
  const { summarize, loading: retrying } = useSummarizeVideo();

  const handleRetry = useCallback(async () => {
    await summarize(
      {
        videoId: delivery.video_id,
        videoTitle: title ?? delivery.video_id,
        language: delivery.language ?? "fr",
      },
      {
        toasts: {
          queued: "Retry started!",
          alreadyProcessed: "Video is already being processed",
          failed: "Retry failed",
        },
        onSuccess: ({ queued }) => {
          if (queued) setLocalStatus("processing");
        },
      },
    );
  }, [summarize, delivery.video_id, delivery.language, title]);

  const handleGenerateLang = useCallback(
    async (langCode: string) => {
      setGeneratingLang(langCode);
      try {
        await summarize(
          {
            videoId: delivery.video_id,
            videoTitle: title ?? delivery.video_id,
            language: langCode,
          },
          {
            toasts: {
              queued: "Generation started!",
              alreadyProcessed: "Summary already available in this language",
              failed: "Generation error",
            },
          },
        );
      } finally {
        setGeneratingLang(null);
      }
    },
    [summarize, delivery.video_id, title],
  );

  const handleOpenLangPicker = useCallback(() => {
    if (!onToggleFavorite) return;
    dialogManager.custom({
      title: "Generate in another language",
      size: "sm",
      children: (
        <LanguagePicker
          currentCode={delivery.language ?? "fr"}
          favorites={favoriteLanguages}
          onSelect={(lang) => {
            dialogManager.closeAll();
            void handleGenerateLang(lang.code);
          }}
          onToggleFavorite={onToggleFavorite}
        />
      ),
    });
  }, [
    delivery.language,
    favoriteLanguages,
    handleGenerateLang,
    onToggleFavorite,
  ]);

  return (
    <div
      className={`nm-raised relative overflow-hidden rounded-2xl transition-all duration-200 ${
        playing ? "ring-1 ring-red-500/25" : ""
      }`}
    >
      {/* Main row: thumbnail + title + controls */}
      <div className="flex items-start gap-3 p-3">
        {/* Thumbnail with play overlay */}
        <button
          onClick={togglePlay}
          className={`group relative h-[64px] w-[114px] shrink-0 overflow-hidden rounded-lg bg-black/30 sm:h-[72px] sm:w-[128px] ${isRead && !playing ? "opacity-50" : ""}`}
        >
          <div
            className="h-full w-full bg-cover bg-center opacity-80 transition-opacity group-hover:opacity-100"
            style={{ backgroundImage: `url(${thumbnailUrl})` }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.1] backdrop-blur-sm transition-all duration-200 ${
                playing
                  ? "bg-red-600/80 shadow-[0_0_12px_rgba(239,68,68,0.4)]"
                  : "bg-black/50"
              }`}
            >
              {playing ? (
                <AudioWaveform />
              ) : (
                <Play className="ml-px h-4 w-4 text-white" fill="white" />
              )}
            </div>
          </div>
          {channelAvatarUrl && (
            <img
              src={channelAvatarUrl}
              alt=""
              className="absolute right-1 bottom-1 z-10 h-6 w-6 rounded-full border-2 border-white/20 object-cover"
              referrerPolicy="no-referrer"
            />
          )}
        </button>

        {/* Title + meta — clickable to toggle summary */}
        <button
          onClick={() => {
            if (!video?.summary) return;
            setShowSummary(!showSummary);
            if (!isRead) {
              localStorage.setItem(`read:${delivery.id}`, "1");
              setIsRead(true);
            }
          }}
          className="min-w-0 flex-1 text-left"
        >
          <p
            className={`line-clamp-2 text-sm leading-snug font-medium ${isRead && !playing ? "text-muted-foreground" : ""}`}
          >
            {title ?? tl.untitledVideo}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-muted-foreground text-xs">
              {delivery.created_at
                ? formatSummaryDate(delivery.created_at)
                : ""}
            </span>
            {channelActive !== undefined && onToggleChannel ? (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleChannel();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    e.preventDefault();
                    onToggleChannel();
                  }
                }}
                className={`flex cursor-pointer items-center gap-1 rounded-full border px-1.5 py-px text-[10px] font-medium transition-all ${
                  channelActive
                    ? "hover:text-muted-foreground/50 border-green-500/20 text-green-500/60 hover:border-white/10"
                    : "text-muted-foreground/40 hover:text-foreground/60 border-white/[0.07] hover:border-white/10"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full transition-colors ${
                    channelActive ? "bg-green-500/60" : "bg-muted-foreground/25"
                  }`}
                />
                {channelActive ? "Active" : "Paused"}
              </span>
            ) : onSubscribeChannel ? (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onSubscribeChannel();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    e.preventDefault();
                    onSubscribeChannel();
                  }
                }}
                className="text-muted-foreground/40 hover:text-foreground/60 flex cursor-pointer items-center gap-1 rounded-full border border-red-500/20 px-1.5 py-px text-[10px] font-medium text-red-400 transition-all hover:text-red-300"
              >
                <Plus className="h-2.5 w-2.5" />
                Subscribe
              </span>
            ) : null}
            {video && (localStatus ?? video.status) !== "completed" && (
              <span
                className={`flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px] font-medium ${
                  (localStatus ?? video.status) === "failed"
                    ? "border-red-500/20 text-red-400"
                    : "border-amber-500/20 text-amber-400"
                }`}
              >
                {(localStatus ?? video.status) !== "failed" && (
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                )}
                {(localStatus ?? video.status) === "failed"
                  ? tl.statusFailed
                  : tl.statusProcessing}
              </span>
            )}
            {!video && (
              <span className="flex items-center gap-1 rounded-full border border-amber-500/20 px-1.5 py-px text-[10px] font-medium text-amber-400">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                {tl.statusProcessing}
              </span>
            )}
          </div>
        </button>

        {/* Right-side actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="text-muted-foreground hover:text-foreground absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-md transition-colors">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {video?.status === "failed" && !localStatus && (
              <>
                <DropdownMenuItem
                  onClick={() => void handleRetry()}
                  disabled={retrying}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {retrying ? "Retrying…" : "Retry processing"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {video?.video_url && (
              <DropdownMenuItem asChild>
                <a
                  href={video.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open on YouTube
                </a>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => void handleShare()}
              className="flex items-center gap-2"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share summary
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {favoriteLanguages
              .filter((l) => l !== delivery.language)
              .map((code) => {
                const lang = LANGUAGES.find((l) => l.code === code);
                if (!lang) return null;
                return (
                  <DropdownMenuItem
                    key={code}
                    disabled={generatingLang === code}
                    onClick={() => void handleGenerateLang(code)}
                    className="flex items-center gap-2"
                  >
                    <Star
                      className="h-3 w-3 shrink-0 text-yellow-400"
                      fill="currentColor"
                    />
                    {generatingLang === code
                      ? "Generating…"
                      : `Generate in ${new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? lang.name}`}
                  </DropdownMenuItem>
                );
              })}
            <DropdownMenuItem
              onClick={handleOpenLangPicker}
              className="flex items-center gap-2"
            >
              <Languages className="h-3.5 w-3.5" />
              Other language…
            </DropdownMenuItem>
            {onSummaryLengthChange && (
              <>
                <DropdownMenuSeparator />
                <div className="text-muted-foreground flex items-center gap-2 px-2 py-1.5 text-xs font-medium">
                  <FileText className="h-3.5 w-3.5" />
                  Summary length
                </div>
                <DropdownMenuItem
                  onClick={() => onSummaryLengthChange(null)}
                  className="flex items-center gap-2 pl-4"
                >
                  <span
                    className={
                      summaryLengthPref == null ? "text-red-400" : "invisible"
                    }
                  >
                    ●
                  </span>
                  Channel default
                </DropdownMenuItem>
                {SUMMARY_LENGTH_OPTIONS.map((opt) => (
                  <DropdownMenuItem
                    key={opt.value}
                    onClick={() => onSummaryLengthChange(opt.value)}
                    className="flex items-center gap-2 pl-4"
                  >
                    <span
                      className={
                        summaryLengthPref === opt.value
                          ? "text-red-400"
                          : "invisible"
                      }
                    >
                      ●
                    </span>
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </>
            )}
            {onSummaryStyleChange && (
              <>
                <DropdownMenuSeparator />
                <div className="text-muted-foreground flex items-center gap-2 px-2 py-1.5 text-xs font-medium">
                  <MessageSquareText className="h-3.5 w-3.5" />
                  Summary style
                </div>
                <DropdownMenuItem
                  onClick={() => onSummaryStyleChange(null)}
                  className="flex items-center gap-2 pl-4"
                >
                  <span
                    className={
                      summaryStylePref == null ? "text-red-400" : "invisible"
                    }
                  >
                    ●
                  </span>
                  Channel default
                </DropdownMenuItem>
                {SUMMARY_STYLE_OPTIONS.map((opt) => (
                  <DropdownMenuItem
                    key={opt.value}
                    onClick={() => onSummaryStyleChange(opt.value)}
                    className="flex items-center gap-2 pl-4"
                  >
                    <span
                      className={
                        summaryStylePref === opt.value
                          ? "text-red-400"
                          : "invisible"
                      }
                    >
                      ●
                    </span>
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </>
            )}
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5">
              <p className="text-muted-foreground mb-1.5 text-xs font-medium">
                Playback speed
              </p>
              <div className="flex items-center gap-1">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    onClick={() => changeSpeed(s)}
                    className={`flex-1 rounded-md px-1.5 py-1 text-[10px] font-semibold tabular-nums transition-all ${
                      speed === s
                        ? "bg-red-600 text-white"
                        : "nm-raised-sm text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    x{s}
                  </button>
                ))}
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Audio element */}
      {video?.audio_url && (
        <audio
          ref={audioRef}
          src={video.audio_url}
          preload="metadata"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
        />
      )}

      {/* Progress bar — only visible when audio has been started */}
      {video?.audio_url && (playing || progress > 0) && (
        <div
          className="mx-3 mb-2.5 h-1 cursor-pointer overflow-hidden rounded-full bg-white/[0.06]"
          onClick={handleSeek}
        >
          <div
            className="h-full rounded-full bg-red-500/70 transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Summary text — revealed on title click */}
      {video?.summary && (
        <div
          className="grid transition-all duration-300 ease-out"
          style={{ gridTemplateRows: showSummary ? "1fr" : "0fr" }}
        >
          <div className="overflow-hidden">
            <div className="max-h-[60vh] overflow-y-auto border-t border-white/[0.04] px-3 py-3">
              <p className="text-foreground text-sm leading-relaxed break-words whitespace-pre-line sm:text-xs">
                {video.summary}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Expand/collapse summary — centered at bottom */}
      {video?.summary && (
        <button
          type="button"
          onClick={() => {
            setShowSummary(!showSummary);
            if (!isRead) {
              localStorage.setItem(`read:${delivery.id}`, "1");
              setIsRead(true);
            }
          }}
          aria-label={showSummary ? "Hide summary" : "Show summary"}
          className="text-muted-foreground/30 hover:text-muted-foreground absolute right-0 bottom-0 left-0 flex items-center justify-center transition-colors"
        >
          <ChevronDown
            className={`h-3 w-3 transition-transform duration-200 ${showSummary ? "rotate-180" : ""}`}
          />
        </button>
      )}
    </div>
  );
}
