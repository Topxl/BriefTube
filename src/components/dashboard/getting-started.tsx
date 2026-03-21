"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleIcon, Languages, Loader2, Check, Youtube } from "@/lib/icons";
import { dialogManager } from "@/features/dialog-manager/dialog-manager";
import { createClient } from "@/lib/supabase/client";
import { languages } from "@/lib/languages";
import type { Language } from "@/lib/languages";

// -----------------------------------------------------------------
// Telegram connect dialog content
// -----------------------------------------------------------------

function TelegramConnectContent({ onConnected }: { onConnected: () => void }) {
  const supabase = createClient();
  const [connectToken, setConnectToken] = useState("");
  const [connected, setConnected] = useState(false);
  const [hasClickedBot, setHasClickedBot] = useState(false);

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
      if (mounted) setConnectToken(token);
    };
    void generateToken();
    return () => {
      mounted = false;
    };
  }, [supabase]);

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
          onClick={() => setHasClickedBot(true)}
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
      {hasClickedBot && (
        <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-xs">
          <Loader2 className="h-3 w-3 animate-spin" />
          Waiting for connection...
        </p>
      )}
    </div>
  );
}

// -----------------------------------------------------------------
// Language picker dialog content
// -----------------------------------------------------------------

function LanguagePickerContent({
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

// -----------------------------------------------------------------
// Main component
// -----------------------------------------------------------------

type Props = {
  hasChannel: boolean;
  hasConnection: boolean;
  language: string;
};

export function GettingStarted({ hasChannel, hasConnection, language }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [languageChosen, setLanguageChosen] = useState(
    () =>
      typeof window !== "undefined" &&
      localStorage.getItem("gs_language_chosen") === "1",
  );

  const showModule = !hasChannel || !hasConnection;
  if (!showModule) return null;

  const langMeta = languages.find((l) => l.code === language);
  const langLabel = langMeta?.nativeName ?? language;

  const openTelegramDialog = () => {
    dialogManager.custom({
      title: "Connect Telegram",
      size: "sm",
      children: <TelegramConnectContent onConnected={() => router.refresh()} />,
    });
  };

  const openLanguageDialog = () => {
    dialogManager.custom({
      title: "Summary language",
      size: "sm",
      children: (
        <LanguagePickerContent
          currentCode={language}
          onSelect={async (lang) => {
            dialogManager.closeAll();
            setLanguageChosen(true);
            localStorage.setItem("gs_language_chosen", "1");
            const {
              data: { user },
            } = await supabase.auth.getUser();
            if (!user) return;
            await supabase
              .from("profiles")
              .update({ preferred_language: lang.code })
              .eq("id", user.id);
            toast.success("Language updated");
            router.refresh();
          }}
        />
      ),
    });
  };

  return (
    <div className="nm-raised overflow-hidden rounded-2xl">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <p className="text-sm font-semibold">Get started with BriefTube</p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Complete these steps to receive your summaries
        </p>
      </div>

      <div className="divide-y divide-white/[0.04]">
        {/* Add a YouTube channel — masqué une fois fait */}
        {!hasChannel && (
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <CircleIcon className="text-muted-foreground h-4 w-4 shrink-0" />
              <div>
                <p className="text-sm font-medium">Add a YouTube channel</p>
                <p className="text-muted-foreground text-[11px]">
                  Subscribe to a channel to get summaries
                </p>
              </div>
            </div>
            <a
              href="/api/youtube/auth"
              className="nm-raised-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-all"
            >
              <Youtube className="h-3 w-3" />
              Import
            </a>
          </div>
        )}

        {/* Connect a delivery channel — masqué une fois fait */}
        {!hasConnection && (
          <div className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3">
              <CircleIcon className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="text-sm font-medium">
                  Connect a delivery channel
                </p>
                <p className="text-muted-foreground text-[11px]">
                  Choose where to receive your summaries
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <div className="flex items-center gap-1.5">
                <a
                  href="/api/connect/discord"
                  className="nm-raised-sm text-muted-foreground hover:text-foreground rounded-full px-2.5 py-1 text-xs transition-all"
                >
                  Discord
                </a>
                <a
                  href="/api/connect/slack"
                  className="nm-raised-sm text-muted-foreground hover:text-foreground rounded-full px-2.5 py-1 text-xs transition-all"
                >
                  Slack
                </a>
                <button
                  onClick={openTelegramDialog}
                  className="nm-raised-sm text-muted-foreground hover:text-foreground rounded-full px-2.5 py-1 text-xs transition-all"
                >
                  Telegram
                </button>
              </div>
              <p className="text-muted-foreground/50 text-[10px]">
                Discord & Slack connect in one click
              </p>
            </div>
          </div>
        )}

        {/* Choose your language — masqué une fois sélectionné */}
        {!languageChosen && (
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Languages className="text-muted-foreground h-4 w-4 shrink-0" />
              <div>
                <p className="text-sm font-medium">Choose your language</p>
                <p className="text-muted-foreground text-[11px]">
                  Language for AI summaries and TTS voice
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">{langLabel}</span>
              <button
                onClick={openLanguageDialog}
                className="nm-raised-sm text-muted-foreground hover:text-foreground rounded-full px-3 py-1 text-xs transition-all"
              >
                Edit
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
