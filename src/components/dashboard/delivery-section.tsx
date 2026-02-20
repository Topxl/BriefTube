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
 * Languages that have several available voices.
 * All other languages get a single voice derived from languages.ts.
 */
const MULTI_VOICES: Partial<Record<string, VoiceEntry[]>> = {
  fr: [
    {
      value: "fr-FR-DeniseNeural",
      label: "Denise",
      tone: "Natural · Expressive",
      locale: "fr-FR",
      sample: "Bonjour, je suis votre assistante audio.",
    },
    {
      value: "fr-FR-HenriNeural",
      label: "Henri",
      tone: "Natural · Calm",
      locale: "fr-FR",
      sample: "Bonjour, je suis votre assistant audio.",
    },
    {
      value: "fr-CA-SylvieNeural",
      label: "Sylvie",
      tone: "Natural · Warm",
      locale: "fr-CA",
      sample: "Bonjour, je suis votre assistante audio.",
    },
  ],
  en: [
    {
      value: "en-US-JennyNeural",
      label: "Jenny",
      tone: "Friendly · Conversational",
      locale: "en-US",
      sample: "Hello, I'm your audio assistant.",
    },
    {
      value: "en-US-GuyNeural",
      label: "Guy",
      tone: "Confident · Warm",
      locale: "en-US",
      sample: "Hello, I'm your audio assistant.",
    },
  ],
};

/** Derive voice name and locale from an Azure Neural voice ID like `th-TH-PremwadeeNeural`. */
function parseVoiceId(voiceId: string): { label: string; locale: string } {
  const parts = voiceId.split("-"); // e.g. ["th", "TH", "PremwadeeNeural"]
  return {
    locale: `${parts[0]}-${parts[1]}`,
    label: (parts[2] ?? "").replace("Neural", ""),
  };
}

function getVoicesForLanguage(langCode: string): VoiceEntry[] {
  if (MULTI_VOICES[langCode]) return MULTI_VOICES[langCode];
  const lang = languages.find((l) => l.code === langCode);
  if (!lang) return [];
  const { label, locale } = parseVoiceId(lang.voice);
  return [
    {
      value: lang.voice,
      label,
      tone: "Natural",
      locale,
      sample: lang.nativeName,
    },
  ];
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
          className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-all duration-200 ${
            currentVoice === v.value
              ? "text-foreground border-red-500/25 bg-red-500/[0.06]"
              : "text-muted-foreground hover:text-foreground border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
          }`}
        >
          <div
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
              currentVoice === v.value
                ? "bg-red-500/20 text-red-400"
                : "text-muted-foreground bg-white/[0.06]"
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
        className="text-foreground placeholder:text-muted-foreground w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm outline-none focus:border-white/20"
      />
      <div className="max-h-64 overflow-y-auto">
        <div className="grid grid-cols-2 gap-1.5">
          {filtered.map((l) => (
            <button
              key={l.code}
              onClick={() => onSelect(l)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all duration-200 ${
                currentCode === l.code
                  ? "text-foreground border-red-500/25 bg-red-500/[0.06]"
                  : "text-muted-foreground hover:text-foreground border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
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

      <div className="divide-y divide-white/[0.04] overflow-hidden rounded-xl border border-white/[0.06]">
        {/* Telegram row */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                telegramConnected
                  ? "border-emerald-500/10 bg-emerald-500/10"
                  : "border-white/[0.06] bg-white/[0.04]"
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
          {!telegramConnected && (
            <Button
              size="sm"
              variant="outline"
              onClick={openTelegramModal}
              className="text-xs"
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
            className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs transition-colors disabled:opacity-50"
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
                className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs transition-colors disabled:opacity-50"
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
