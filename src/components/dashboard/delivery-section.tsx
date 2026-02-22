"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, Loader2, Play } from "@/lib/icons";
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
  onSelect,
}: {
  currentCode: string;
  onSelect: (lang: Language) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = search.trim()
    ? languages.filter(
        (l) =>
          l.name.toLowerCase().includes(search.toLowerCase()) ||
          l.nativeName.toLowerCase().includes(search.toLowerCase()),
      )
    : languages;

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Search language..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="nm-inset text-foreground placeholder:text-muted-foreground w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white/20"
      />
      <div className="max-h-64 overflow-y-auto">
        <div className="grid grid-cols-2 gap-1.5">
          {filtered.map((l) => (
            <button
              key={l.code}
              onClick={() => onSelect(l)}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-left transition-all duration-200 ${
                currentCode === l.code
                  ? "nm-inset text-foreground"
                  : "nm-raised-sm text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="min-w-0">
                <p className="text-[12px] leading-none font-medium">
                  {l.nativeName}
                </p>
                <p className="text-muted-foreground mt-0.5 text-[10px]">
                  {l.name}
                </p>
              </div>
              {currentCode === l.code && (
                <Check className="ml-auto h-3 w-3 shrink-0 text-red-400" />
              )}
            </button>
          ))}
        </div>
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
        .from("profiles")
        .select("telegram_connected")
        .eq("id", user.id)
        .single();
      if (data?.telegram_connected) {
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
  initialVoice: string;
  initialLanguage: string;
};

export function DeliverySection({
  initialTelegramConnected,
  initialVoice,
  initialLanguage,
}: Props) {
  const supabase = createClient();
  const [telegramConnected, setTelegramConnected] = useState(
    initialTelegramConnected,
  );
  const [voice, setVoice] = useState(initialVoice);
  const [savingVoice, setSavingVoice] = useState(false);
  const [language, setLanguage] = useState(initialLanguage);
  const [savingLanguage, setSavingLanguage] = useState(false);

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

  const openLanguagePicker = () => {
    dialogManager.custom({
      title: "Summary language",
      size: "sm",
      children: (
        <LanguagePicker
          currentCode={language}
          onSelect={(lang) => {
            dialogManager.closeAll();
            void updateLanguage(lang);
          }}
        />
      ),
    });
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
            <Button
              size="sm"
              variant="outline"
              onClick={openTelegramModal}
              className="rounded-full text-xs"
            >
              Connect
            </Button>
          )}
        </div>

        {/* Language row */}
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-medium">Summary language</p>
            <p className="text-muted-foreground text-[11px]">
              {currentLanguageMeta?.nativeName ?? "English"} ·{" "}
              {currentLanguageMeta?.name ?? "English"}
            </p>
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
          <div>
            <p className="text-sm font-medium">Audio voice</p>
            <p className="text-muted-foreground text-[11px]">
              {currentVoiceEntry.label} · {currentVoiceEntry.tone}
            </p>
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
