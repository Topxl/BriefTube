"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Loader2,
  ArrowRight,
  ArrowLeft,
  Youtube,
  Headphones,
  Send,
  Layers,
  Check,
} from "@/lib/icons";
import type { Tables } from "@/types/supabase";
import { SiteConfig } from "@/site-config";
import { languages } from "@/lib/languages";
import type { Language } from "@/lib/languages";
import { ListPicker } from "@/components/lists/list-picker";
import type { ListPickerItem } from "@/components/lists/list-picker";

type Subscription = Tables<"subscriptions">;

type CuratedList = ListPickerItem;

type Step = 1 | 2 | 3;

type Props = {
  initialVoice: string;
  referralCode?: string;
  curatedLists: CuratedList[];
};

export function OnboardingWizard({
  initialVoice,
  referralCode,
  curatedLists,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [step, setStep] = useState<Step>(1);
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [followingList, setFollowingList] = useState(false);

  // Step 1 — manual add (secondary)
  const [sources, setSources] = useState<Subscription[]>([]);
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [showManualAdd, setShowManualAdd] = useState(false);

  // Step 2 — language
  const [voice, setVoice] = useState(initialVoice);
  const [savingVoice, setSavingVoice] = useState(false);
  const [langSearch, setLangSearch] = useState("");

  // Step 3 — Telegram
  const [connectToken, setConnectToken] = useState("");
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [completing, setCompleting] = useState(false);

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
    if (step === 3 && !connectToken) {
      void generateTelegramToken();
    }
  }, [step, connectToken, generateTelegramToken]);

  useEffect(() => {
    if (step !== 3 || telegramConnected) return;

    const interval = setInterval(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("telegram_connected")
        .eq("id", user.id)
        .single();
      if (data?.telegram_connected) {
        setTelegramConnected(true);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [step, telegramConnected, supabase]);

  useEffect(() => {
    if (telegramConnected) {
      toast.success("Telegram connected!");
      const timer = setTimeout(() => void complete(), 4000);
      return () => clearTimeout(timer);
    }
  }, [telegramConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  const followListAndAdvance = async () => {
    if (selectedListIds.length === 0) {
      setStep(2);
      return;
    }
    setFollowingList(true);
    try {
      const res = await fetch("/api/onboarding/follow-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listIds: selectedListIds }),
      });
      if (res.ok) {
        const data = (await res.json()) as { subscribed: number };
        if (data.subscribed > 0) {
          toast.success(`${data.subscribed} channels added!`);
        }
      }
    } catch {
      toast.error("Failed to subscribe. Please try again.");
      setFollowingList(false);
      return;
    }
    setFollowingList(false);
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

  const saveLang = async (lang: Language) => {
    setVoice(lang.voice);
    setSavingVoice(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ tts_voice: lang.voice, preferred_language: lang.code })
      .eq("id", user.id);
    setSavingVoice(false);
  };

  const complete = async () => {
    setCompleting(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", user.id);
    router.push("/dashboard");
  };

  return (
    <div className="w-full max-w-lg">
      {/* Progress indicator */}
      <div className="mb-10 flex items-center justify-center gap-2">
        {([1, 2, 3] as Step[]).map((s) => (
          <div
            key={s}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              s <= step ? "w-10 bg-red-500" : "w-3 bg-white/[0.12]"
            }`}
          />
        ))}
      </div>

      {/* Step 1: Pick a curated playlist */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/[0.08]">
              <Layers className="h-7 w-7 text-red-400" />
            </div>
            <div>
              <p className="text-muted-foreground mb-1 text-sm font-medium">
                Step 1 of 3
              </p>
              <h1 className="text-2xl font-bold">
                What do you want to listen to?
              </h1>
              <p className="text-muted-foreground mt-1.5 text-sm">
                Pick a playlist and get audio summaries delivered automatically
                to your Telegram.
              </p>
            </div>
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

          {/* Secondary options */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-white/[0.06]" />
              <span className="text-muted-foreground text-[11px]">or</span>
              <div className="h-px flex-1 bg-white/[0.06]" />
            </div>

            <a
              href="/api/youtube/auth"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.06] px-4 py-2.5 text-sm font-medium text-white/60 transition-all hover:bg-white/[0.04] hover:text-white/90"
            >
              <Youtube className="h-4 w-4 text-red-400" />
              Import from YouTube
            </a>

            <button
              type="button"
              onClick={() => setShowManualAdd((v) => !v)}
              className="text-muted-foreground hover:text-foreground w-full text-center text-xs transition-colors"
            >
              {showManualAdd ? "Hide manual add" : "Add a channel manually"}
            </button>

            {showManualAdd && (
              <form
                onSubmit={(e) => void addSource(e)}
                className="flex gap-2"
                suppressHydrationWarning
              >
                <Input
                  type="text"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setAddError("");
                  }}
                  placeholder="youtube.com/@mkbhd"
                  className="flex-1"
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                  suppressHydrationWarning
                />
                <Button
                  type="submit"
                  disabled={adding || !url.trim()}
                  className="shrink-0 bg-red-600 hover:bg-red-500"
                  suppressHydrationWarning
                >
                  {adding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Add"
                  )}
                </Button>
              </form>
            )}
            {addError && <p className="text-xs text-red-400">{addError}</p>}
            {sources.length > 0 && (
              <p className="text-muted-foreground text-xs">
                {sources.length} channel{sources.length > 1 ? "s" : ""} added
                manually.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="text-muted-foreground hover:text-foreground text-xs transition-colors"
            >
              Skip for now
            </button>
            <Button
              onClick={() => void followListAndAdvance()}
              disabled={followingList}
              className="bg-red-600 hover:bg-red-500"
            >
              {followingList ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Subscribing…
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Choose language */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/[0.08]">
              <Headphones className="h-7 w-7 text-violet-400" />
            </div>
            <div>
              <p className="text-muted-foreground mb-1 text-sm font-medium">
                Step 2 of 3
              </p>
              <h1 className="text-2xl font-bold">Select your language</h1>
              <p className="text-muted-foreground mt-1.5 text-sm">
                Your audio summaries will be delivered in this language.
              </p>
            </div>
          </div>

          <Input
            type="text"
            value={langSearch}
            onChange={(e) => setLangSearch(e.target.value)}
            placeholder="Search a language..."
            className="w-full"
            suppressHydrationWarning
          />

          <div className="grid max-h-72 grid-cols-2 gap-1.5 overflow-y-auto sm:grid-cols-3">
            {languages
              .filter(
                (l) =>
                  l.name.toLowerCase().includes(langSearch.toLowerCase()) ||
                  l.nativeName.toLowerCase().includes(langSearch.toLowerCase()),
              )
              .map((l) => {
                const isSelected = voice === l.voice;
                return (
                  <button
                    key={l.code}
                    onClick={() => void saveLang(l)}
                    disabled={savingVoice}
                    className={`flex flex-col rounded-lg border px-3 py-2.5 text-left text-sm transition-all duration-150 ${
                      isSelected
                        ? "text-foreground border-red-500/25 bg-red-500/[0.06]"
                        : "text-muted-foreground hover:text-foreground border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                    }`}
                  >
                    <span className="truncate text-[13px] leading-none font-medium">
                      {l.name}
                    </span>
                    <span className="text-muted-foreground mt-0.5 truncate text-[11px]">
                      {l.nativeName}
                    </span>
                  </button>
                );
              })}
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setStep(1)}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
            <Button
              onClick={() => setStep(3)}
              className="bg-red-600 hover:bg-red-500"
            >
              Continue
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Connect Telegram */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-500/20 bg-sky-500/[0.08]">
              <Send className="h-7 w-7 text-sky-400" />
            </div>
            <div>
              <p className="text-muted-foreground mb-1 text-sm font-medium">
                Step 3 of 3
              </p>
              <h1 className="text-2xl font-bold">Connect Telegram</h1>
              <p className="text-muted-foreground mt-1.5 text-sm">
                Your audio summaries will be delivered automatically.
              </p>
            </div>
          </div>

          {telegramConnected ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] px-6 py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
                <Check className="h-6 w-6 text-emerald-400" />
              </div>
              <div className="w-full space-y-4">
                <p className="font-semibold text-emerald-400">Connected!</p>
                {referralCode && (
                  <div className="space-y-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-left">
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
                        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.04] px-3 py-1.5 text-xs transition-colors"
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
                        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.04] px-3 py-1.5 text-xs transition-colors"
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
            <div className="space-y-4">
              <div className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-xs font-semibold">
                    1
                  </span>
                  <p className="pt-0.5 text-sm">
                    Open the BriefTube bot in Telegram
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-xs font-semibold">
                    2
                  </span>
                  <p className="pt-0.5 text-sm">
                    Tap <strong>Start</strong> — that&apos;s it
                  </p>
                </div>
              </div>

              {connectToken ? (
                <a
                  href={`https://t.me/brief_tube_bot?start=${connectToken}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2AABEE] px-4 py-3 text-sm font-semibold text-white transition-all hover:brightness-110"
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                  </svg>
                  Open BriefTube Bot
                </a>
              ) : (
                <div className="text-muted-foreground flex items-center justify-center gap-2 py-3 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating link...
                </div>
              )}

              <div className="text-muted-foreground flex items-center justify-center gap-2 text-xs">
                <Loader2 className="h-3 w-3 animate-spin" />
                Waiting for connection...
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setStep(2)}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
            <button
              onClick={() => void complete()}
              disabled={completing}
              className="text-muted-foreground hover:text-foreground text-xs transition-colors disabled:opacity-50"
            >
              {completing ? "Redirecting..." : "Skip for now"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
