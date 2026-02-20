"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Check,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Youtube,
  Headphones,
  Send,
} from "@/lib/icons";
import type { Tables } from "@/types/supabase";

type Subscription = Tables<"subscriptions">;

type Step = 1 | 2 | 3;

type Language = {
  name: string;
  nativeName: string;
  code: string;
  voice: string;
};

const languages: Language[] = [
  {
    name: "English",
    nativeName: "English",
    code: "en",
    voice: "en-US-JennyNeural",
  },
  {
    name: "Spanish",
    nativeName: "Español",
    code: "es",
    voice: "es-ES-ElviraNeural",
  },
  {
    name: "French",
    nativeName: "Français",
    code: "fr",
    voice: "fr-FR-DeniseNeural",
  },
  {
    name: "German",
    nativeName: "Deutsch",
    code: "de",
    voice: "de-DE-KatjaNeural",
  },
  {
    name: "Portuguese",
    nativeName: "Português",
    code: "pt",
    voice: "pt-BR-FranciscaNeural",
  },
  {
    name: "Chinese",
    nativeName: "中文",
    code: "zh",
    voice: "zh-CN-XiaoxiaoNeural",
  },
  {
    name: "Japanese",
    nativeName: "日本語",
    code: "ja",
    voice: "ja-JP-NanamiNeural",
  },
  {
    name: "Korean",
    nativeName: "한국어",
    code: "ko",
    voice: "ko-KR-SunHiNeural",
  },
  {
    name: "Arabic",
    nativeName: "العربية",
    code: "ar",
    voice: "ar-SA-ZariyahNeural",
  },
  {
    name: "Hindi",
    nativeName: "हिन्दी",
    code: "hi",
    voice: "hi-IN-SwaraNeural",
  },
  {
    name: "Russian",
    nativeName: "Русский",
    code: "ru",
    voice: "ru-RU-SvetlanaNeural",
  },
  {
    name: "Italian",
    nativeName: "Italiano",
    code: "it",
    voice: "it-IT-ElsaNeural",
  },
  {
    name: "Dutch",
    nativeName: "Nederlands",
    code: "nl",
    voice: "nl-NL-ColetteNeural",
  },
  {
    name: "Turkish",
    nativeName: "Türkçe",
    code: "tr",
    voice: "tr-TR-EmelNeural",
  },
  {
    name: "Polish",
    nativeName: "Polski",
    code: "pl",
    voice: "pl-PL-ZofiaNeural",
  },
  {
    name: "Swedish",
    nativeName: "Svenska",
    code: "sv",
    voice: "sv-SE-SofieNeural",
  },
  {
    name: "Norwegian",
    nativeName: "Norsk",
    code: "nb",
    voice: "nb-NO-PernilleNeural",
  },
  {
    name: "Danish",
    nativeName: "Dansk",
    code: "da",
    voice: "da-DK-ChristelNeural",
  },
  {
    name: "Finnish",
    nativeName: "Suomi",
    code: "fi",
    voice: "fi-FI-SelmaNeural",
  },
  {
    name: "Indonesian",
    nativeName: "Indonesia",
    code: "id",
    voice: "id-ID-GadisNeural",
  },
  {
    name: "Malay",
    nativeName: "Melayu",
    code: "ms",
    voice: "ms-MY-YasminNeural",
  },
  {
    name: "Vietnamese",
    nativeName: "Tiếng Việt",
    code: "vi",
    voice: "vi-VN-HoaiMyNeural",
  },
  {
    name: "Thai",
    nativeName: "ภาษาไทย",
    code: "th",
    voice: "th-TH-PremwadeeNeural",
  },
  {
    name: "Ukrainian",
    nativeName: "Українська",
    code: "uk",
    voice: "uk-UA-PolinaNeural",
  },
  {
    name: "Czech",
    nativeName: "Čeština",
    code: "cs",
    voice: "cs-CZ-VlastaNeural",
  },
  {
    name: "Romanian",
    nativeName: "Română",
    code: "ro",
    voice: "ro-RO-AlinaNeural",
  },
  {
    name: "Hungarian",
    nativeName: "Magyar",
    code: "hu",
    voice: "hu-HU-NoemiNeural",
  },
  {
    name: "Greek",
    nativeName: "Ελληνικά",
    code: "el",
    voice: "el-GR-AthinaNeural",
  },
  {
    name: "Hebrew",
    nativeName: "עברית",
    code: "he",
    voice: "he-IL-HilaNeural",
  },
  {
    name: "Bengali",
    nativeName: "বাংলা",
    code: "bn",
    voice: "bn-IN-TanishaaNeural",
  },
  { name: "Urdu", nativeName: "اردو", code: "ur", voice: "ur-PK-UzmaNeural" },
  {
    name: "Persian",
    nativeName: "فارسی",
    code: "fa",
    voice: "fa-IR-DilaraNeural",
  },
  {
    name: "Filipino",
    nativeName: "Filipino",
    code: "fil",
    voice: "fil-PH-BlessicaNeural",
  },
  {
    name: "Tamil",
    nativeName: "தமிழ்",
    code: "ta",
    voice: "ta-IN-PallaviNeural",
  },
  {
    name: "Telugu",
    nativeName: "తెలుగు",
    code: "te",
    voice: "te-IN-ShrutiNeural",
  },
  {
    name: "Kannada",
    nativeName: "ಕನ್ನಡ",
    code: "kn",
    voice: "kn-IN-SapnaNeural",
  },
  {
    name: "Malayalam",
    nativeName: "മലയാളം",
    code: "ml",
    voice: "ml-IN-SobhanaNeural",
  },
  {
    name: "Gujarati",
    nativeName: "ગુજરાતી",
    code: "gu",
    voice: "gu-IN-DhwaniNeural",
  },
  {
    name: "Marathi",
    nativeName: "मराठी",
    code: "mr",
    voice: "mr-IN-AarohiNeural",
  },
  {
    name: "Punjabi",
    nativeName: "ਪੰਜਾਬੀ",
    code: "pa",
    voice: "pa-IN-VaaniNeural",
  },
  {
    name: "Swahili",
    nativeName: "Kiswahili",
    code: "sw",
    voice: "sw-KE-ZuriNeural",
  },
  {
    name: "Bulgarian",
    nativeName: "Български",
    code: "bg",
    voice: "bg-BG-KalinaNeural",
  },
  {
    name: "Croatian",
    nativeName: "Hrvatski",
    code: "hr",
    voice: "hr-HR-GabrijelaNeural",
  },
  {
    name: "Slovak",
    nativeName: "Slovenčina",
    code: "sk",
    voice: "sk-SK-ViktoriaNeural",
  },
  {
    name: "Lithuanian",
    nativeName: "Lietuvių",
    code: "lt",
    voice: "lt-LT-OnaNeural",
  },
  {
    name: "Latvian",
    nativeName: "Latviešu",
    code: "lv",
    voice: "lv-LV-EveritaNeural",
  },
  {
    name: "Estonian",
    nativeName: "Eesti",
    code: "et",
    voice: "et-EE-AnuNeural",
  },
  {
    name: "Catalan",
    nativeName: "Català",
    code: "ca",
    voice: "ca-ES-JoanaNeural",
  },
  {
    name: "Serbian",
    nativeName: "Српски",
    code: "sr",
    voice: "sr-RS-SophieNeural",
  },
  {
    name: "Slovenian",
    nativeName: "Slovenščina",
    code: "sl",
    voice: "sl-SI-PetraNeural",
  },
  {
    name: "Nepali",
    nativeName: "नेपाली",
    code: "ne",
    voice: "ne-NP-HemkalaNeural",
  },
  {
    name: "Amharic",
    nativeName: "አማርኛ",
    code: "am",
    voice: "am-ET-MekdesNeural",
  },
  {
    name: "Azerbaijani",
    nativeName: "Azərbaycan",
    code: "az",
    voice: "az-AZ-BanuNeural",
  },
  {
    name: "Georgian",
    nativeName: "ქართული",
    code: "ka",
    voice: "ka-GE-EkaNeural",
  },
  {
    name: "Kazakh",
    nativeName: "Қазақ",
    code: "kk",
    voice: "kk-KZ-AigulNeural",
  },
];

type Props = {
  initialVoice: string;
};

export function OnboardingWizard({ initialVoice }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [step, setStep] = useState<Step>(1);
  const [sources, setSources] = useState<Subscription[]>([]);
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [voice, setVoice] = useState(initialVoice);
  const [savingVoice, setSavingVoice] = useState(false);
  const [langSearch, setLangSearch] = useState("");
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
      // Load the imported sources and advance to step 2
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
      const timer = setTimeout(() => void complete(), 2000);
      return () => clearTimeout(timer);
    }
  }, [telegramConnected]); // eslint-disable-line react-hooks/exhaustive-deps

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

      {/* Step 1: Add a source */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/[0.08]">
              <Youtube className="h-7 w-7 text-red-400" />
            </div>
            <div>
              <p className="text-muted-foreground mb-1 text-sm font-medium">
                Step 1 of 3
              </p>
              <h1 className="text-2xl font-bold">Import your subscriptions</h1>
              <p className="text-muted-foreground mt-1.5 text-sm">
                Connect your YouTube account to import all your channels in one
                click.
              </p>
            </div>
          </div>

          {/* PRIMARY: YouTube import */}
          <a
            href="/api/youtube/auth"
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-red-600 px-4 py-3.5 text-sm font-semibold text-white shadow-[0_0_24px_rgba(239,68,68,0.2)] transition-all hover:bg-red-500 hover:shadow-[0_0_32px_rgba(239,68,68,0.3)]"
          >
            <Youtube className="h-5 w-5" />
            Import from YouTube
          </a>

          {/* SECONDARY: manual add toggle */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setShowManualAdd((v) => !v)}
              className="text-muted-foreground hover:text-foreground w-full text-center text-xs transition-colors"
            >
              {showManualAdd ? "Hide manual add" : "Or add a channel manually"}
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
          </div>

          {addError && <p className="text-xs text-red-400">{addError}</p>}

          {sources.length > 0 && (
            <div className="space-y-2">
              {sources.map((source) => (
                <div
                  key={source.id}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                    source.active
                      ? "border-emerald-500/15 bg-emerald-500/[0.04]"
                      : "border-white/[0.06] bg-white/[0.02] opacity-60"
                  }`}
                >
                  {source.channel_avatar_url ? (
                    <Image
                      src={source.channel_avatar_url}
                      alt={source.channel_name}
                      width={28}
                      height={28}
                      className="h-7 w-7 shrink-0 rounded-full"
                      suppressHydrationWarning
                    />
                  ) : (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-xs font-bold text-red-400">
                      {source.channel_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {source.channel_name}
                  </span>
                  {source.active ? (
                    <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                  ) : (
                    <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                      Paused
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="text-muted-foreground hover:text-foreground text-xs transition-colors"
            >
              Later
            </button>
            <Button
              onClick={() => setStep(2)}
              disabled={sources.length === 0}
              className="bg-red-600 hover:bg-red-500"
            >
              Continue
              <ArrowRight className="ml-1.5 h-4 w-4" />
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
            <div className="flex flex-col items-center gap-3 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
                <Check className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <p className="font-semibold text-emerald-400">Connected!</p>
                <p className="text-muted-foreground mt-0.5 text-sm">
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
                    Tap <strong>Start</strong> — that's it
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
