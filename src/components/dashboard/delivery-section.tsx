"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, Headphones, Languages, Loader2, Play, Star } from "@/lib/icons";
import { dialogManager } from "@/features/dialog-manager/dialog-manager";
import { languages } from "@/lib/languages";
import type { Language } from "@/lib/languages";

// -----------------------------------------------------------------
// Voice helpers
// -----------------------------------------------------------------

type VoiceEntry = {
  value: string;
  label: string;
  tone: string;
  locale: string;
  sample: string;
};

/**
 * One female + one male voice per language.
 * Languages not listed here get a single default voice from languages.ts.
 */
const VOICE_PAIRS: Partial<Record<string, readonly [string, string]>> = {
  fr: ["fr-FR-DeniseNeural", "fr-FR-HenriNeural"],
  en: ["en-US-JennyNeural", "en-US-GuyNeural"],
  es: ["es-ES-ElviraNeural", "es-ES-AlvaroNeural"],
  de: ["de-DE-KatjaNeural", "de-DE-ConradNeural"],
  pt: ["pt-BR-FranciscaNeural", "pt-BR-AntonioNeural"],
  zh: ["zh-CN-XiaoxiaoNeural", "zh-CN-YunxiNeural"],
  ja: ["ja-JP-NanamiNeural", "ja-JP-KeitaNeural"],
  ko: ["ko-KR-SunHiNeural", "ko-KR-InJoonNeural"],
  ar: ["ar-SA-ZariyahNeural", "ar-SA-HamedNeural"],
  hi: ["hi-IN-SwaraNeural", "hi-IN-MadhurNeural"],
  ru: ["ru-RU-SvetlanaNeural", "ru-RU-DmitryNeural"],
  it: ["it-IT-ElsaNeural", "it-IT-DiegoNeural"],
  nl: ["nl-NL-ColetteNeural", "nl-NL-MaartenNeural"],
  tr: ["tr-TR-EmelNeural", "tr-TR-AhmetNeural"],
  pl: ["pl-PL-ZofiaNeural", "pl-PL-MarekNeural"],
  sv: ["sv-SE-SofieNeural", "sv-SE-MattiasNeural"],
  nb: ["nb-NO-PernilleNeural", "nb-NO-FinnNeural"],
  da: ["da-DK-ChristelNeural", "da-DK-JeppeNeural"],
  fi: ["fi-FI-SelmaNeural", "fi-FI-HarriNeural"],
  id: ["id-ID-GadisNeural", "id-ID-ArdiNeural"],
  ms: ["ms-MY-YasminNeural", "ms-MY-OsmanNeural"],
  vi: ["vi-VN-HoaiMyNeural", "vi-VN-NamMinhNeural"],
  th: ["th-TH-PremwadeeNeural", "th-TH-NiwatNeural"],
  uk: ["uk-UA-PolinaNeural", "uk-UA-OstapNeural"],
  cs: ["cs-CZ-VlastaNeural", "cs-CZ-AntoninNeural"],
  ro: ["ro-RO-AlinaNeural", "ro-RO-EmilNeural"],
  hu: ["hu-HU-NoemiNeural", "hu-HU-TamasNeural"],
  el: ["el-GR-AthinaNeural", "el-GR-NestorasNeural"],
  he: ["he-IL-HilaNeural", "he-IL-AvriNeural"],
  bg: ["bg-BG-KalinaNeural", "bg-BG-BorislavNeural"],
  hr: ["hr-HR-GabrijelaNeural", "hr-HR-SreckoNeural"],
  sk: ["sk-SK-ViktoriaNeural", "sk-SK-LukasNeural"],
  lt: ["lt-LT-OnaNeural", "lt-LT-LeonasNeural"],
  lv: ["lv-LV-EveritaNeural", "lv-LV-NilsNeural"],
  et: ["et-EE-AnuNeural", "et-EE-KertNeural"],
  ca: ["ca-ES-JoanaNeural", "ca-ES-EnricNeural"],
  sr: ["sr-RS-SophieNeural", "sr-RS-NicholasNeural"],
  sl: ["sl-SI-PetraNeural", "sl-SI-RokNeural"],
};

const VOICE_GENDER: ["Female", "Male"] = ["Female", "Male"];

/** Derive voice name and locale from an Azure Neural voice ID like `th-TH-PremwadeeNeural`. */
function parseVoiceId(voiceId: string): { label: string; locale: string } {
  const parts = voiceId.split("-"); // e.g. ["th", "TH", "PremwadeeNeural"]
  return {
    locale: `${parts[0]}-${parts[1]}`,
    label: (parts[2] ?? "").replace("Neural", ""),
  };
}

function getVoicesForLanguage(langCode: string): VoiceEntry[] {
  const lang = languages.find((l) => l.code === langCode);
  const sample = lang?.nativeName ?? langCode;

  const pair = VOICE_PAIRS[langCode];
  if (pair) {
    return pair.map((voiceId, i) => {
      const { label, locale } = parseVoiceId(voiceId);
      return {
        value: voiceId,
        label,
        tone: VOICE_GENDER[i as 0 | 1],
        locale,
        sample,
      };
    });
  }

  // Single-voice fallback for languages without a known male counterpart
  if (!lang) return [];
  const { label, locale } = parseVoiceId(lang.voice);
  return [{ value: lang.voice, label, tone: "Natural", locale, sample }];
}

// -----------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------

function previewVoice(locale: string, sample: string, e: React.MouseEvent) {
  e.stopPropagation();
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(sample);
  utterance.lang = locale;
  window.speechSynthesis.speak(utterance);
}

function VoicePicker({
  currentVoice,
  voiceList,
  onSelect,
}: {
  currentVoice: string;
  voiceList: VoiceEntry[];
  onSelect: (v: string) => void;
}) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {voiceList.map((v) => (
        <div
          key={v.value}
          role="button"
          tabIndex={0}
          onClick={() => onSelect(v.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(v.value);
            }
          }}
          className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-all duration-200 ${
            currentVoice === v.value
              ? "nm-inset text-foreground"
              : "nm-raised-sm text-muted-foreground hover:text-foreground"
          }`}
        >
          <div
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
              currentVoice === v.value
                ? "nm-inset-sm bg-red-500/[0.15] text-red-400"
                : "nm-raised-sm text-muted-foreground"
            }`}
          >
            {v.label.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] leading-none font-medium">{v.label}</p>
            <p className="text-muted-foreground mt-0.5 text-[10px]">{v.tone}</p>
          </div>
          <button
            onClick={(e) => previewVoice(v.locale, v.sample, e)}
            className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
            aria-label={`Preview ${v.label}`}
          >
            <Play className="h-3 w-3" />
          </button>
          {currentVoice === v.value && (
            <Check className="h-3 w-3 shrink-0 text-red-400" />
          )}
        </div>
      ))}
    </div>
  );
}

function LanguagePicker({
  currentCode,
  favorites,
  onSelect,
  onToggleFavorite,
}: {
  currentCode: string;
  favorites: string[];
  onSelect: (lang: Language) => void;
  onToggleFavorite: (code: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [showOthers, setShowOthers] = useState(false);

  const q = search.trim().toLowerCase();
  const allFiltered = q
    ? languages.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.nativeName.toLowerCase().includes(q),
      )
    : null;

  const favLangs = languages.filter((l) => favorites.includes(l.code));
  const otherLangs = languages.filter((l) => !favorites.includes(l.code));

  const displayFavs = allFiltered
    ? allFiltered.filter((l) => favorites.includes(l.code))
    : favLangs;
  const displayOthers = allFiltered
    ? allFiltered.filter((l) => !favorites.includes(l.code))
    : otherLangs;

  const showOthersSection = allFiltered ? displayOthers.length > 0 : showOthers;

  function LangButton({ l }: { l: Language }) {
    const isFav = favorites.includes(l.code);
    return (
      <div
        className={`flex items-center gap-1.5 rounded-xl px-2.5 py-2 transition-all duration-200 ${
          currentCode === l.code
            ? "nm-inset text-foreground"
            : "nm-raised-sm text-muted-foreground hover:text-foreground"
        }`}
      >
        <button
          onClick={() => onSelect(l)}
          className="min-w-0 flex-1 text-left"
        >
          <p className="text-[12px] leading-none font-medium">{l.nativeName}</p>
          <p className="text-muted-foreground mt-0.5 text-[10px]">{l.name}</p>
        </button>
        {currentCode === l.code && (
          <Check className="h-3 w-3 shrink-0 text-red-400" />
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(l.code);
          }}
          className={`shrink-0 transition-colors ${isFav ? "hover:text-muted-foreground text-yellow-400" : "text-muted-foreground/30 hover:text-yellow-400"}`}
          aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
        >
          <Star className="h-3 w-3" fill={isFav ? "currentColor" : "none"} />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Search language..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="nm-inset text-foreground placeholder:text-muted-foreground w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white/20"
      />
      <div className="max-h-72 space-y-3 overflow-y-auto">
        {/* Favorites */}
        {displayFavs.length > 0 && (
          <div className="space-y-1.5">
            {!allFiltered && (
              <p className="text-muted-foreground/50 px-1 text-[10px] font-medium tracking-wide uppercase">
                Favorites
              </p>
            )}
            <div className="grid grid-cols-2 gap-1.5">
              {displayFavs.map((l) => (
                <LangButton key={l.code} l={l} />
              ))}
            </div>
          </div>
        )}

        {/* Other languages */}
        {!allFiltered && displayOthers.length > 0 && (
          <div className="space-y-1.5">
            <button
              onClick={() => setShowOthers((v) => !v)}
              className="text-muted-foreground/50 hover:text-muted-foreground flex items-center gap-1 px-1 text-[10px] font-medium tracking-wide uppercase transition-colors"
            >
              Other languages
              <span className="text-[9px]">{showOthers ? "▲" : "▼"}</span>
            </button>
            {showOthers && (
              <div className="grid grid-cols-2 gap-1.5">
                {displayOthers.map((l) => (
                  <LangButton key={l.code} l={l} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Search results — others */}
        {allFiltered && showOthersSection && (
          <div className="grid grid-cols-2 gap-1.5">
            {displayOthers.map((l) => (
              <LangButton key={l.code} l={l} />
            ))}
          </div>
        )}

        {allFiltered &&
          displayFavs.length === 0 &&
          displayOthers.length === 0 && (
            <p className="text-muted-foreground py-4 text-center text-sm">
              No language found
            </p>
          )}
      </div>
    </div>
  );
}

function TelegramConnectContent({ onConnected }: { onConnected: () => void }) {
  const supabase = createClient();
  const [connectToken, setConnectToken] = useState("");
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let mounted = true;

    const generateToken = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const token = crypto.randomUUID().replace(/-/g, "");
      await supabase
        .from("profiles")
        .update({ telegram_connect_token: token })
        .eq("id", user.id);
      if (mounted) {
        setConnectToken(token);
      }
    };

    void generateToken();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  // Poll for connection
  useEffect(() => {
    if (connected) return;
    const interval = setInterval(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("platform_connections")
        .select("connected")
        .eq("user_id", user.id)
        .eq("platform", "telegram")
        .maybeSingle();
      if (data?.connected) {
        setConnected(true);
        clearInterval(interval);
        toast.success("Telegram connected!");
        onConnected();
        dialogManager.closeAll();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [connected, supabase, onConnected]);

  if (connected) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20">
          <Check className="h-5 w-5 text-emerald-400" />
        </div>
        <p className="text-sm font-medium text-emerald-400">Connected!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-muted-foreground space-y-2 text-sm">
        <p className="flex items-start gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[11px] font-semibold">
            1
          </span>
          Open the BriefTube bot in Telegram
        </p>
        <p className="flex items-start gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[11px] font-semibold">
            2
          </span>
          Tap <strong className="text-foreground">Start</strong>
        </p>
      </div>

      {connectToken ? (
        <a
          href={`https://t.me/brief_tube_bot?start=${connectToken}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#2AABEE] px-4 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
          </svg>
          Open BriefTube Bot
        </a>
      ) : (
        <div className="text-muted-foreground flex items-center justify-center gap-2 py-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating link...
        </div>
      )}

      <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-xs">
        <Loader2 className="h-3 w-3 animate-spin" />
        Waiting for connection...
      </p>
    </div>
  );
}

// -----------------------------------------------------------------
// Main component
// -----------------------------------------------------------------

type Props = {
  initialTelegramConnected: boolean;
  initialNotionConnected: boolean;
  initialNotionDatabaseName?: string;
  initialWhatsappConnected: boolean;
  initialWhatsappPhone?: string;
  initialVoice: string;
  initialLanguage: string;
  initialFavorites?: string[];
};

export function DeliverySection({
  initialTelegramConnected,
  initialNotionConnected,
  initialNotionDatabaseName = "",
  initialWhatsappConnected,
  initialWhatsappPhone = "",
  initialVoice,
  initialLanguage,
  initialFavorites = [],
}: Props) {
  const supabase = createClient();
  const [telegramConnected, setTelegramConnected] = useState(
    initialTelegramConnected,
  );
  const [notionConnected, setNotionConnected] = useState(
    initialNotionConnected,
  );
  const [notionDbName, setNotionDbName] = useState(initialNotionDatabaseName);
  const [whatsappConnected, setWhatsappConnected] = useState(
    initialWhatsappConnected,
  );
  const [whatsappPhone, setWhatsappPhone] = useState(initialWhatsappPhone);
  const [waLink, setWaLink] = useState<string | null>(null);
  const [waConnecting, setWaConnecting] = useState(false);
  const [voice, setVoice] = useState(initialVoice);
  const [savingVoice, setSavingVoice] = useState(false);
  const [language, setLanguage] = useState(initialLanguage);
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(initialFavorites);

  const currentLanguageMeta = languages.find((l) => l.code === language);
  const voiceList = getVoicesForLanguage(language);
  const currentVoiceEntry =
    voiceList.find((v) => v.value === voice) ?? voiceList[0];
  const hasMultipleVoices = voiceList.length > 1;

  const openTelegramModal = () => {
    dialogManager.custom({
      title: "Connect Telegram",
      size: "sm",
      children: (
        <TelegramConnectContent
          onConnected={() => setTelegramConnected(true)}
        />
      ),
    });
  };

  const updateVoice = async (v: string) => {
    setVoice(v);
    setSavingVoice(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({ tts_voice: v }).eq("id", user.id);
    setSavingVoice(false);
    toast.success("Voice updated");
  };

  const openVoicePicker = () => {
    dialogManager.custom({
      title: "Audio voice",
      size: "sm",
      children: (
        <VoicePicker
          currentVoice={voice}
          voiceList={voiceList}
          onSelect={(v) => {
            dialogManager.closeAll();
            void updateVoice(v);
          }}
        />
      ),
    });
  };

  const updateLanguage = async (lang: Language) => {
    // Reset voice to the default for the new language
    const newVoices = getVoicesForLanguage(lang.code);
    const defaultVoice = newVoices[0]?.value ?? lang.voice;
    setLanguage(lang.code);
    setVoice(defaultVoice);
    setSavingLanguage(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ preferred_language: lang.code, tts_voice: defaultVoice })
      .eq("id", user.id);
    setSavingLanguage(false);
    toast.success("Language updated");
  };

  const toggleFavorite = async (code: string) => {
    const next = favorites.includes(code)
      ? favorites.filter((c) => c !== code)
      : [...favorites, code];
    setFavorites(next);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ favorite_languages: next })
      .eq("id", user.id);
  };

  const openLanguagePicker = () => {
    dialogManager.custom({
      title: "Summary language",
      size: "sm",
      children: (
        <LanguagePicker
          currentCode={language}
          favorites={favorites}
          onSelect={(lang) => {
            dialogManager.closeAll();
            void updateLanguage(lang);
          }}
          onToggleFavorite={(code) => void toggleFavorite(code)}
        />
      ),
    });
  };

  const disconnectNotion = async () => {
    await fetch("/api/connect/notion/disconnect", { method: "POST" });
    setNotionConnected(false);
    setNotionDbName("");
    toast.success("Notion disconnected");
  };

  const startWhatsappConnect = async () => {
    setWaConnecting(true);
    try {
      const res = await fetch("/api/connect/whatsapp/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        toast.error(err.error ?? "Failed to generate link");
        setWaConnecting(false);
        return;
      }
      const data = (await res.json()) as { waLink: string };
      setWaLink(data.waLink);

      // Poll for connection status every 2s for up to 5 min
      const pollInterval = setInterval(async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          clearInterval(pollInterval);
          return;
        }
        const { data: connection } = await supabase
          .from("platform_connections")
          .select("connected")
          .eq("user_id", user.id)
          .eq("platform", "whatsapp")
          .maybeSingle();

        if (connection?.connected) {
          clearInterval(pollInterval);
          setWaLink(null);
          setWaConnecting(false);
          setWhatsappConnected(true);
          // Fetch the phone number
          const { data: pc } = await supabase
            .from("platform_connections")
            .select("external_id")
            .eq("user_id", user.id)
            .eq("platform", "whatsapp")
            .single();
          if (pc?.external_id) {
            setWhatsappPhone(pc.external_id);
          }
          toast.success("WhatsApp connected!");
        }
      }, 2000);

      // Stop polling after 5 minutes
      setTimeout(
        () => {
          clearInterval(pollInterval);
          if (waLink) {
            toast.error("Connection timeout. Please try again.");
            setWaLink(null);
            setWaConnecting(false);
          }
        },
        5 * 60 * 1000,
      );
    } catch {
      toast.error("Failed to start connection");
      setWaConnecting(false);
    }
  };

  const disconnectWhatsapp = async () => {
    await fetch("/api/connect/whatsapp/disconnect", { method: "POST" });
    setWhatsappConnected(false);
    setWhatsappPhone("");
    toast.success("WhatsApp disconnected");
  };

  return (
    <section className="space-y-2">
      <h2 className="text-muted-foreground/50 px-1 text-xs font-medium tracking-wide uppercase">
        Delivery
      </h2>

      <div className="nm-raised divide-y divide-white/[0.05] overflow-hidden rounded-2xl">
        {/* Telegram row */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                telegramConnected
                  ? "nm-inset-sm bg-emerald-500/[0.08]"
                  : "nm-inset-sm"
              }`}
            >
              <svg
                className={`h-4 w-4 ${telegramConnected ? "text-emerald-400" : "text-muted-foreground"}`}
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium">Telegram</p>
              <p
                className={`text-[11px] ${telegramConnected ? "text-emerald-400" : "text-muted-foreground"}`}
              >
                {telegramConnected ? "Connected" : "Not connected"}
              </p>
            </div>
          </div>
          {telegramConnected ? (
            <button
              onClick={openTelegramModal}
              className="nm-raised-sm text-muted-foreground hover:text-foreground rounded-full px-3 py-1 text-xs transition-all"
            >
              Reconnect
            </button>
          ) : (
            <button
              onClick={openTelegramModal}
              className="nm-raised-sm text-muted-foreground hover:text-foreground rounded-full px-3 py-1 text-xs transition-all"
            >
              Connect
            </button>
          )}
        </div>

        {/* Notion row */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                notionConnected
                  ? "nm-inset-sm bg-emerald-500/[0.08]"
                  : "nm-inset-sm"
              }`}
            >
              <svg
                className={`h-4 w-4 ${notionConnected ? "text-emerald-400" : "text-muted-foreground"}`}
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium">Notion</p>
              <p
                className={`text-[11px] ${notionConnected ? "text-emerald-400" : "text-muted-foreground"}`}
              >
                {notionConnected
                  ? notionDbName
                    ? `Connected · ${notionDbName}`
                    : "Connected"
                  : "Not connected"}
              </p>
            </div>
          </div>
          {notionConnected ? (
            <button
              onClick={() => void disconnectNotion()}
              className="nm-raised-sm text-muted-foreground hover:text-foreground rounded-full px-3 py-1 text-xs transition-all"
            >
              Disconnect
            </button>
          ) : (
            <a
              href="/api/connect/notion"
              className="nm-raised-sm text-muted-foreground hover:text-foreground rounded-full px-3 py-1 text-xs transition-all"
            >
              Connect
            </a>
          )}
        </div>

        {/* WhatsApp row */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                whatsappConnected
                  ? "nm-inset-sm bg-emerald-500/[0.08]"
                  : "nm-inset-sm"
              }`}
            >
              <svg
                className={`h-4 w-4 ${whatsappConnected ? "text-emerald-400" : "text-muted-foreground"}`}
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium">WhatsApp</p>
              <p
                className={`text-[11px] ${whatsappConnected ? "text-emerald-400" : waLink ? "text-muted-foreground" : "text-muted-foreground"}`}
              >
                {whatsappConnected
                  ? `Connected · ${whatsappPhone}`
                  : waLink
                    ? "Waiting for confirmation..."
                    : "Not connected"}
              </p>
            </div>
          </div>
          {whatsappConnected ? (
            <button
              onClick={() => void disconnectWhatsapp()}
              className="nm-raised-sm text-muted-foreground hover:text-foreground rounded-full px-3 py-1 text-xs transition-all"
            >
              Disconnect
            </button>
          ) : waLink ? (
            <div className="flex items-center gap-2">
              <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />
              <Button
                size="sm"
                variant="outline"
                className="rounded-full text-xs"
                asChild
              >
                <a href={waLink} target="_blank" rel="noopener noreferrer">
                  Open WhatsApp
                </a>
              </Button>
              <button
                onClick={() => setWaLink(null)}
                className="nm-raised-sm text-muted-foreground hover:text-foreground rounded-full px-3 py-1 text-xs transition-all"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => void startWhatsappConnect()}
              disabled={waConnecting}
              className="nm-raised-sm text-muted-foreground hover:text-foreground rounded-full px-3 py-1 text-xs transition-all disabled:opacity-50"
            >
              {waConnecting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Connect"
              )}
            </button>
          )}
        </div>

        {/* Language row */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="nm-inset-sm flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
              <Languages className="text-muted-foreground h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium">Summary language</p>
              <p className="text-muted-foreground text-[11px]">
                {currentLanguageMeta?.nativeName ?? "English"} ·{" "}
                {currentLanguageMeta?.name ?? "English"}
              </p>
            </div>
          </div>
          <button
            onClick={openLanguagePicker}
            disabled={savingLanguage}
            className="nm-raised-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-all disabled:opacity-50"
          >
            {savingLanguage ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              "Change"
            )}
          </button>
        </div>

        {/* Voice row */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="nm-inset-sm flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
              <Headphones className="text-muted-foreground h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium">Audio voice</p>
              <p className="text-muted-foreground text-[11px]">
                {currentVoiceEntry.label} · {currentVoiceEntry.tone}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={(e) =>
                previewVoice(
                  currentVoiceEntry.locale,
                  currentVoiceEntry.sample,
                  e,
                )
              }
              className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
              aria-label="Preview voice"
            >
              <Play className="h-3.5 w-3.5" />
            </button>
            {hasMultipleVoices && (
              <button
                onClick={openVoicePicker}
                disabled={savingVoice}
                className="nm-raised-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-all disabled:opacity-50"
              >
                {savingVoice ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Change"
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
