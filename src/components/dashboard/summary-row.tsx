"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import {
  ChevronDown,
  ExternalLink,
  Play,
  MoreHorizontal,
  RefreshCw,
  Share2,
  Languages,
  Star,
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
import { addProcessingVideo } from "@/lib/processing-videos";
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

export function SummaryRow({
  delivery,
  resolvedTitle,
  favoriteLanguages = [],
  onManageFavorites: _onManageFavorites,
  onToggleFavorite,
  channelActive,
  onToggleChannel,
  channelAvatarUrl,
}: {
  delivery: EnrichedDelivery;
  resolvedTitle?: string;
  favoriteLanguages?: string[];
  onManageFavorites?: () => void;
  onToggleFavorite?: (code: string) => void;
  channelActive?: boolean;
  onToggleChannel?: () => void;
  channelAvatarUrl?: string | null;
}) {
  const video = delivery.video;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
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
      void audio.play();
      if (!isRead) {
        localStorage.setItem(`read:${delivery.id}`, "1");
        setIsRead(true);
      }
    }
    setPlaying(!playing);
  }, [playing, isRead, delivery.id]);

  const cycleSpeed = useCallback(() => {
    const audio = audioRef.current;
    const idx = SPEEDS.indexOf(speed);
    const next = SPEEDS[(idx + 1) % SPEEDS.length];
    setSpeed(next);
    if (audio) audio.playbackRate = next;
  }, [speed]);

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
  const [retrying, setRetrying] = useState(false);
  const [localStatus, setLocalStatus] = useState<string | null>(null);

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    try {
      const res = await fetch("/api/process-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: delivery.video_id,
          videoTitle: title ?? delivery.video_id,
          language: delivery.language ?? "fr",
        }),
      });
      if (!res.ok) {
        toast.error("Retry failed");
        return;
      }
      const data = (await res.json()) as { queued?: boolean };
      if (data.queued) {
        addProcessingVideo({
          videoId: delivery.video_id,
          title: title ?? delivery.video_id,
          startedAt: Date.now(),
        });
        setLocalStatus("processing");
        toast.success("Retry started!");
      } else {
        toast.info("Video is already being processed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setRetrying(false);
    }
  }, [delivery.video_id, delivery.language, title]);

  const handleGenerateLang = useCallback(
    async (langCode: string) => {
      setGeneratingLang(langCode);
      try {
        const res = await fetch("/api/process-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoId: delivery.video_id,
            videoTitle: title ?? delivery.video_id,
            language: langCode,
          }),
        });
        if (!res.ok) {
          toast.error("Generation error");
          return;
        }
        const data = (await res.json()) as { queued?: boolean };
        if (data.queued) {
          addProcessingVideo({
            videoId: delivery.video_id,
            title: title ?? delivery.video_id,
            startedAt: Date.now(),
          });
          toast.success("Generation started!");
        } else {
          toast.info("Summary already available in this language");
        }
      } catch {
        toast.error("Network error");
      } finally {
        setGeneratingLang(null);
      }
    },
    [delivery.video_id, title],
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
      <div className="flex items-center gap-3 p-3">
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
            {video && (localStatus ?? video.status) !== "completed" && (
              <span
                className={`rounded-full px-1.5 py-px text-[10px] font-medium ${
                  (localStatus ?? video.status) === "failed"
                    ? "bg-red-500/20 text-red-400"
                    : "bg-yellow-500/20 text-yellow-400"
                }`}
              >
                {(localStatus ?? video.status) === "failed"
                  ? tl.statusFailed
                  : tl.statusProcessing}
              </span>
            )}
            {!video && (
              <span className="rounded-full bg-yellow-500/20 px-1.5 py-px text-[10px] font-medium text-yellow-400">
                {tl.statusProcessing}
              </span>
            )}
            {channelActive !== undefined && onToggleChannel && (
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
            )}
            {video?.summary && (
              <ChevronDown
                className={`text-muted-foreground h-3 w-3 transition-transform duration-200 ${showSummary ? "rotate-180" : ""}`}
              />
            )}
          </div>
        </button>

        {/* Right-side actions */}
        <button
          onClick={cycleSpeed}
          className="nm-raised-sm text-muted-foreground hover:text-foreground shrink-0 self-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums transition-all"
        >
          x{speed}
        </button>
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
    </div>
  );
}
