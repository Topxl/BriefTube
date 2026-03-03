"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Loader2,
  ArrowRight,
  ArrowLeft,
  Youtube,
  Check,
  Globe,
  Mail,
  Play,
  Pause,
} from "@/lib/icons";
import type { Tables } from "@/types/supabase";
import { SiteConfig } from "@/site-config";
// import { ListPicker } from "@/components/lists/list-picker";
// import type { ListPickerItem } from "@/components/lists/list-picker";
import { capture } from "@/lib/posthog/client";

type Subscription = Tables<"subscriptions">;

// type CuratedList = ListPickerItem;

type Step = 1 | 2;

type WowVideo = {
  video_id: string;
  video_title: string | null;
  audio_url: string | null;
};

function WowAudioCard({ video }: { video: WowVideo }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      void a.play();
      setPlaying(true);
    }
  };

  return (
    <div className="nm-raised overflow-hidden rounded-2xl p-3">
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          className="group relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-black/30"
        >
          <Image
            src={`https://img.youtube.com/vi/${video.video_id}/default.jpg`}
            alt=""
            fill
            sizes="48px"
            className="object-cover opacity-80 transition-opacity group-hover:opacity-100"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm">
              {playing ? (
                <Pause className="h-3 w-3 text-white" fill="white" />
              ) : (
                <Play className="ml-px h-3 w-3 text-white" fill="white" />
              )}
            </div>
          </div>
        </button>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-sm font-medium">
            {video.video_title ?? "Video summary"}
          </p>
          {video.audio_url && (
            <>
              <audio
                ref={audioRef}
                src={video.audio_url}
                preload="metadata"
                onTimeUpdate={(e) => {
                  const a = e.currentTarget;
                  if (a.duration)
                    setProgress((a.currentTime / a.duration) * 100);
                }}
                onEnded={() => {
                  setPlaying(false);
                  setProgress(0);
                }}
              />
              <div className="mt-2 h-1 w-full rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-red-500 transition-[width] duration-100"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

type DeliveryMethod =
  | "telegram"
  | "website"
  | "email"
  | "whatsapp"
  | "discord"
  | "slack";

type Props = {
  referralCode?: string;
  // curatedLists: CuratedList[];
};

export function OnboardingWizard({ referralCode }: Props) {
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [step, setStep] = useState<Step>(1);
  const [showWow, setShowWow] = useState(false);
  const [wowVideos, setWowVideos] = useState<WowVideo[]>([]);
  // const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  // const [followingList, setFollowingList] = useState(false);

  // Step 1 — manual add (secondary)
  const [sources, setSources] = useState<Subscription[]>([]);
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  // Step 2 — delivery method selection
  const [selectedMethod, setSelectedMethod] = useState<DeliveryMethod | null>(
    null,
  );

  // Step 2 — Telegram
  const [connectToken, setConnectToken] = useState("");
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [hasClickedBot, setHasClickedBot] = useState(false);

  // Handle return from YouTube OAuth import
  useEffect(() => {
    const youtubeImported = searchParams.get("youtube_imported");
    const youtubeError = searchParams.get("youtube_error");

    if (youtubeError) {
      const messages: Record<string, string> = {
        limit_reached:
          "Channel limit reached. Upgrade to Pro for unlimited channels.",
        access_denied: "YouTube access denied.",
        import_failed: "Import failed. Please try again.",
        invalid_state: "Invalid request. Please try again.",
        no_code: "Authorization failed. Please try again.",
      };
      toast.error(messages[youtubeError] ?? "YouTube import failed.");
      return;
    }

    if (youtubeImported) {
      const count = parseInt(youtubeImported, 10);
      toast.success(
        `${count} channel${count !== 1 ? "s" : ""} imported from YouTube!`,
      );
      void (async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (data && data.length > 0) {
          setSources(data);

          // Fetch existing completed videos for the wow effect
          const channelIds = data.map((s) => s.channel_id);
          const { data: videos } = await supabase
            .from("processed_videos")
            .select("video_id, video_title, audio_url")
            .in("channel_id", channelIds)
            .eq("status", "completed")
            .not("audio_url", "is", null)
            .limit(5);

          if (videos && videos.length > 0) {
            setWowVideos(videos as WowVideo[]);
            setShowWow(true);
          } else {
            setStep(2);
          }
        } else {
          setStep(2);
        }
      })();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const generateTelegramToken = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const token = crypto.randomUUID().replace(/-/g, "");
    await supabase
      .from("profiles")
      .update({ telegram_connect_token: token })
      .eq("id", user.id);
    setConnectToken(token);
  }, [supabase]);

  useEffect(() => {
    if (step === 2 && !connectToken) {
      void generateTelegramToken();
    }
  }, [step, connectToken, generateTelegramToken]);

  useEffect(() => {
    if (step !== 2 || telegramConnected) return;

    let attempts = 0;
    const MAX_ATTEMPTS = 40; // 2 minutes max (40 × 3s)

    const interval = setInterval(async () => {
      attempts++;
      if (attempts >= MAX_ATTEMPTS) {
        clearInterval(interval);
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("telegram_connected")
        .eq("id", user.id)
        .maybeSingle();
      if (data?.telegram_connected) {
        setTelegramConnected(true);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [step, telegramConnected, supabase]);

  useEffect(() => {
    if (telegramConnected) {
      capture("telegram_connected");
      toast.success("Telegram linked!");
      const timer = setTimeout(() => void complete(), 4000);
      return () => clearTimeout(timer);
    }
  }, [telegramConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  // followListAndAdvance — disabled with curated lists
  const followListAndAdvance = async () => {
    capture("onboarding_step_completed", { step: 1, method: "skipped" });
    setStep(2);
  };

  const addSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setAdding(true);
    setAddError("");
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json()) as Subscription & { error?: string };
      if (!res.ok) {
        setAddError(data.error ?? "Failed to add channel");
        return;
      }
      setSources((prev) => [...prev, data]);
      setUrl("");
    } catch {
      setAddError("Something went wrong");
    } finally {
      setAdding(false);
    }
  };

  const complete = async () => {
    setCompleting(true);
    capture("onboarding_completed", {
      telegram_connected: telegramConnected,
      channels_count: sources.length,
    });
    // Update onboarding_completed directly from the browser session.
    // The admin-client server action was silently failing (no error surfaced before redirect).
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("id", user.id);
    }
    // Hard navigation — forces a fresh server render of /dashboard, bypassing any router cache.
    window.location.href = "/dashboard";
  };

  return (
    <div className="w-full max-w-lg">
      {/* Header: logo + step dots */}
      <div className="mb-8 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logo.svg"
            alt="BriefTube"
            width={26}
            height={26}
            suppressHydrationWarning
          />
          <span className="text-sm font-semibold">BriefTube</span>
        </Link>
        <div className="flex items-center gap-2">
          {([1, 2] as Step[]).map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                s <= step ? "w-8 bg-red-500" : "nm-inset-sm w-3 bg-transparent"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Wow screen: shown after YouTube import if existing summaries exist */}
      {showWow && (
        <div className="space-y-6">
          <div>
            <p className="text-muted-foreground mb-1 text-sm font-medium">
              Welcome to BriefTube
            </p>
            <h1 className="text-2xl font-bold">
              Your channels already have summaries!
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm">
              We&apos;ve already processed some videos from your channels. Try
              listening to one.
            </p>
          </div>

          <div className="space-y-2.5">
            {wowVideos.map((video) => (
              <WowAudioCard key={video.video_id} video={video} />
            ))}
          </div>

          <Button
            onClick={() => {
              setShowWow(false);
              setStep(2);
            }}
            className="w-full bg-red-600 hover:bg-red-500"
          >
            Continue
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Step 1: Add channels */}
      {!showWow && step === 1 && (
        <div className="space-y-6">
          <div>
            <p className="text-muted-foreground mb-1 text-sm font-medium">
              Step 1 of 2
            </p>
            <h1 className="text-2xl font-bold">Add your YouTube channels</h1>
            <p className="text-muted-foreground mt-1.5 text-sm">
              Import the channels you already follow on YouTube — BriefTube will
              send you audio summaries for each new video.
            </p>
          </div>

          {/* Primary action: Import from YouTube */}
          <div className="space-y-3">
            <a
              href="/api/youtube/auth"
              className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-red-500"
            >
              <Youtube className="h-4 w-4" />
              Import from YouTube
            </a>

            {/* Manual add — visible by default */}
            <form
              onSubmit={(e) => void addSource(e)}
              className="flex gap-2"
              data-form-type="other"
              suppressHydrationWarning
            >
              <Input
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setAddError("");
                }}
                placeholder="Or paste a channel URL — youtube.com/@mkbhd"
                className="nm-inset flex-1 border-transparent bg-transparent focus-visible:ring-0"
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                suppressHydrationWarning
              />
              <Button
                type="submit"
                disabled={adding || !url.trim()}
                variant="outline"
                className="shrink-0"
                suppressHydrationWarning
              >
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
              </Button>
            </form>
            {addError && <p className="text-xs text-red-400">{addError}</p>}
            {sources.length > 0 && (
              <div className="nm-inset flex items-center gap-2 rounded-lg px-3 py-2">
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                <p className="text-muted-foreground text-xs">
                  <span className="text-foreground font-medium">
                    {sources.length} channel{sources.length > 1 ? "s" : ""}
                  </span>{" "}
                  added
                </p>
              </div>
            )}
          </div>

          {/* Secondary option: curated playlists — disabled for now, available from dashboard */}
          {/* <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-white/[0.06]" />
              <span className="text-muted-foreground text-[11px]">
                or discover channels by topic
              </span>
              <div className="h-px flex-1 bg-white/[0.06]" />
            </div>

            <ListPicker
              lists={curatedLists}
              selectedIds={selectedListIds}
              onToggle={(id) =>
                setSelectedListIds((prev) =>
                  prev.includes(id)
                    ? prev.filter((x) => x !== id)
                    : [...prev, id],
                )
              }
            />
          </div> */}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              suppressHydrationWarning
              className="text-muted-foreground hover:text-foreground text-xs transition-colors"
            >
              Skip for now
            </button>
            <Button
              onClick={() => void followListAndAdvance()}
              className="bg-red-600 hover:bg-red-500"
            >
              Continue
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Delivery method */}
      {!showWow && step === 2 && (
        <div className="space-y-6">
          <div>
            <p className="text-muted-foreground mb-1 text-sm font-medium">
              Step 2 of 2
            </p>
            <h1 className="text-2xl font-bold">
              Where should we send your summaries?
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm">
              Pick your preferred delivery method. More options are coming soon
              — vote to help us prioritize.
            </p>
          </div>

          {/* Delivery method grid */}
          <div className="grid grid-cols-3 gap-2">
            {/* Telegram — available */}
            <button
              type="button"
              onClick={() => {
                setSelectedMethod("telegram");
                capture("delivery_method_selected", { method: "telegram" });
              }}
              className={`nm-raised relative flex flex-col items-center gap-2 rounded-xl p-3 text-center transition-all duration-200 ${
                selectedMethod === "telegram"
                  ? "scale-[1.03] bg-[#2AABEE]/10 ring-2 ring-[#2AABEE]"
                  : "hover:brightness-110"
              }`}
            >
              {selectedMethod === "telegram" && (
                <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#2AABEE]">
                  <Check className="h-2.5 w-2.5 text-white" />
                </span>
              )}
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2AABEE]/15">
                <svg
                  className="h-5 w-5 text-[#2AABEE]"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
              </div>
              <p className="text-xs leading-tight font-medium">Telegram</p>
              <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                Available
              </span>
            </button>

            {/* Website — available */}
            <button
              type="button"
              onClick={() => {
                setSelectedMethod("website");
                capture("delivery_method_selected", { method: "website" });
              }}
              className={`nm-raised relative flex flex-col items-center gap-2 rounded-xl p-3 text-center transition-all duration-200 ${
                selectedMethod === "website"
                  ? "scale-[1.03] bg-red-500/10 ring-2 ring-red-500"
                  : "hover:brightness-110"
              }`}
            >
              {selectedMethod === "website" && (
                <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500">
                  <Check className="h-2.5 w-2.5 text-white" />
                </span>
              )}
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/15">
                <Globe className="h-5 w-5 text-red-400" />
              </div>
              <p className="text-xs leading-tight font-medium">Website</p>
              <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                Available
              </span>
            </button>

            {/* Email — coming soon */}
            <button
              type="button"
              onClick={() => {
                setSelectedMethod("email");
                capture("delivery_preference_voted", { platform: "email" });
              }}
              className={`nm-raised relative flex flex-col items-center gap-2 rounded-xl p-3 text-center transition-all duration-200 ${
                selectedMethod === "email"
                  ? "scale-[1.03] bg-white/[0.06] ring-2 ring-white/50"
                  : "hover:brightness-110"
              }`}
            >
              {selectedMethod === "email" && (
                <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white/20">
                  <Check className="h-2.5 w-2.5 text-white" />
                </span>
              )}
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5">
                <Mail
                  className={`h-5 w-5 ${selectedMethod === "email" ? "text-foreground" : "text-muted-foreground"}`}
                />
              </div>
              <p
                className={`text-xs leading-tight font-medium ${selectedMethod === "email" ? "text-foreground" : "text-muted-foreground"}`}
              >
                Email
              </p>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] ${selectedMethod === "email" ? "bg-white/15 text-white/70" : "text-muted-foreground/60 bg-white/5"}`}
              >
                Soon
              </span>
            </button>

            {/* WhatsApp — coming soon */}
            <button
              type="button"
              onClick={() => {
                setSelectedMethod("whatsapp");
                capture("delivery_preference_voted", { platform: "whatsapp" });
              }}
              className={`nm-raised relative flex flex-col items-center gap-2 rounded-xl p-3 text-center transition-all duration-200 ${
                selectedMethod === "whatsapp"
                  ? "scale-[1.03] bg-[#25D366]/10 ring-2 ring-[#25D366]/60"
                  : "hover:brightness-110"
              }`}
            >
              {selectedMethod === "whatsapp" && (
                <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#25D366]/30">
                  <Check className="h-2.5 w-2.5 text-[#25D366]" />
                </span>
              )}
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#25D366]/10">
                <svg
                  className="h-5 w-5 text-[#25D366]"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </div>
              <p
                className={`text-xs leading-tight font-medium ${selectedMethod === "whatsapp" ? "text-foreground" : "text-muted-foreground"}`}
              >
                WhatsApp
              </p>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] ${selectedMethod === "whatsapp" ? "bg-[#25D366]/20 text-[#25D366]" : "text-muted-foreground/60 bg-white/5"}`}
              >
                Soon
              </span>
            </button>

            {/* Discord — coming soon */}
            <button
              type="button"
              onClick={() => {
                setSelectedMethod("discord");
                capture("delivery_preference_voted", { platform: "discord" });
              }}
              className={`nm-raised relative flex flex-col items-center gap-2 rounded-xl p-3 text-center transition-all duration-200 ${
                selectedMethod === "discord"
                  ? "scale-[1.03] bg-[#5865F2]/10 ring-2 ring-[#5865F2]/60"
                  : "hover:brightness-110"
              }`}
            >
              {selectedMethod === "discord" && (
                <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#5865F2]/30">
                  <Check className="h-2.5 w-2.5 text-[#5865F2]" />
                </span>
              )}
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#5865F2]/10">
                <svg
                  className="h-5 w-5 text-[#5865F2]"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.032.054a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
              </div>
              <p
                className={`text-xs leading-tight font-medium ${selectedMethod === "discord" ? "text-foreground" : "text-muted-foreground"}`}
              >
                Discord
              </p>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] ${selectedMethod === "discord" ? "bg-[#5865F2]/20 text-[#5865F2]" : "text-muted-foreground/60 bg-white/5"}`}
              >
                Soon
              </span>
            </button>

            {/* Slack — coming soon */}
            <button
              type="button"
              onClick={() => {
                setSelectedMethod("slack");
                capture("delivery_preference_voted", { platform: "slack" });
              }}
              className={`nm-raised relative flex flex-col items-center gap-2 rounded-xl p-3 text-center transition-all duration-200 ${
                selectedMethod === "slack"
                  ? "scale-[1.03] bg-[#E01E5A]/10 ring-2 ring-[#E01E5A]/60"
                  : "hover:brightness-110"
              }`}
            >
              {selectedMethod === "slack" && (
                <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#E01E5A]/30">
                  <Check className="h-2.5 w-2.5 text-[#E01E5A]" />
                </span>
              )}
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E01E5A]/10">
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"
                    fill="#E01E5A"
                  />
                </svg>
              </div>
              <p
                className={`text-xs leading-tight font-medium ${selectedMethod === "slack" ? "text-foreground" : "text-muted-foreground"}`}
              >
                Slack
              </p>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] ${selectedMethod === "slack" ? "bg-[#E01E5A]/20 text-[#E01E5A]" : "text-muted-foreground/60 bg-white/5"}`}
              >
                Soon
              </span>
            </button>
          </div>

          {/* Voted confirmation for coming soon options */}
          {selectedMethod &&
            !["telegram", "website"].includes(selectedMethod) && (
              <div className="nm-inset flex items-center gap-2 rounded-xl px-3 py-2.5">
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                <p className="text-muted-foreground text-xs">
                  Noted! We&apos;ll let you know when{" "}
                  <span className="text-foreground font-medium capitalize">
                    {selectedMethod}
                  </span>{" "}
                  support is ready.
                </p>
              </div>
            )}

          {/* Telegram connect flow */}
          {selectedMethod === "telegram" && (
            <div className="space-y-3">
              {telegramConnected ? (
                <div className="nm-raised flex flex-col items-center gap-3 rounded-2xl bg-emerald-500/[0.04] px-6 py-6 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20">
                    <Check className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div className="w-full space-y-3">
                    <p className="font-semibold text-emerald-400">Connected!</p>
                    {referralCode && (
                      <div className="nm-inset space-y-2 rounded-xl p-3 text-left">
                        <p className="text-xs font-medium">
                          Share BriefTube with friends
                        </p>
                        <p className="text-muted-foreground truncate text-[11px]">
                          {`${SiteConfig.prodUrl}/?ref=${referralCode}`}
                        </p>
                        <div className="flex gap-2">
                          <a
                            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent("I use BriefTube to get AI audio summaries of YouTube videos on Telegram — try it:")}&url=${encodeURIComponent(`${SiteConfig.prodUrl}/?ref=${referralCode}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="nm-raised-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-all"
                          >
                            <svg
                              className="h-3 w-3"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.91-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                            </svg>
                            X
                          </a>
                          <a
                            href={`https://t.me/share/url?url=${encodeURIComponent(`${SiteConfig.prodUrl}/?ref=${referralCode}`)}&text=${encodeURIComponent("I use BriefTube to get AI audio summaries of YouTube videos on Telegram — try it:")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="nm-raised-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-all"
                          >
                            <svg
                              className="h-3 w-3"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                            </svg>
                            Telegram
                          </a>
                        </div>
                      </div>
                    )}
                    <p className="text-muted-foreground text-sm">
                      Taking you to your dashboard...
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="nm-raised space-y-3 rounded-2xl p-4">
                    <div className="flex items-start gap-3">
                      <span className="nm-raised-sm flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                        1
                      </span>
                      <p className="pt-0.5 text-sm">
                        Open the BriefTube bot in Telegram
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="nm-raised-sm flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                        2
                      </span>
                      <p className="pt-0.5 text-sm">
                        Tap <strong>Start</strong> — that&apos;s it
                      </p>
                    </div>
                  </div>
                  <p className="text-muted-foreground/60 text-[11px]">
                    The bot only sends you audio files. It cannot read your
                    messages or access your Telegram account.
                  </p>
                  {connectToken ? (
                    <a
                      href={`https://t.me/brief_tube_bot?start=${connectToken}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setHasClickedBot(true)}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2AABEE] px-4 py-3 text-sm font-semibold text-white transition-all hover:brightness-110"
                    >
                      <svg
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                      </svg>
                      Open BriefTube Bot
                    </a>
                  ) : (
                    <div className="text-muted-foreground flex items-center justify-center gap-2 py-3 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating link...
                    </div>
                  )}
                  {hasClickedBot && (
                    <div className="text-muted-foreground flex items-center justify-center gap-2 text-xs">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Waiting for connection...
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Website option confirmation */}
          {selectedMethod === "website" && (
            <div className="nm-inset flex items-center gap-3 rounded-xl px-4 py-3">
              <Globe className="text-muted-foreground h-4 w-4 shrink-0" />
              <p className="text-muted-foreground text-sm">
                Your summaries will be available directly in your dashboard. You
                can connect Telegram later from settings.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setStep(1)}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
            {selectedMethod !== "telegram" && (
              <Button
                onClick={() => void complete()}
                disabled={completing}
                className="bg-red-600 hover:bg-red-500"
              >
                {completing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Go to dashboard
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
