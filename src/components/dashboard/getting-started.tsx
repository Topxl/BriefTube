"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, Youtube, ArrowRight } from "@/lib/icons";
import { dialogManager } from "@/features/dialog-manager/dialog-manager";
import { createClient } from "@/lib/supabase/client";

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
// Main component
// -----------------------------------------------------------------

type Props = {
  hasChannel: boolean;
  hasConnection: boolean;
  onboardingCompleted: boolean;
};

export function GettingStarted({
  hasChannel,
  hasConnection,
  onboardingCompleted,
}: Props) {
  const router = useRouter();
  const [showTip, setShowTip] = useState(false);

  if (hasChannel && (hasConnection || onboardingCompleted) && !showTip)
    return null;

  const openTelegramDialog = () => {
    dialogManager.custom({
      title: "Connect Telegram",
      size: "sm",
      children: <TelegramConnectContent onConnected={() => router.refresh()} />,
    });
  };

  // Step 1: no channel yet — focus entirely on importing YouTube subscriptions.
  if (!hasChannel) {
    return (
      <a
        href="/api/youtube/auth"
        className="nm-raised group relative block overflow-hidden rounded-2xl p-6 transition-all hover:brightness-110"
      >
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="nm-inset flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
              <Youtube className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <p className="text-base font-semibold">
                Import your YouTube subscriptions
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                Bring in every channel you already follow in one click. No URLs
                to paste, no manual setup.
              </p>
            </div>
          </div>
          <div className="inline-flex shrink-0 items-center gap-2 rounded-full bg-red-500 px-5 py-2.5 text-sm font-semibold text-white transition-transform group-hover:translate-x-0.5">
            Import from YouTube
            <ArrowRight className="h-4 w-4" />
          </div>
        </div>
        <p className="text-muted-foreground/70 mt-4 text-xs">
          Or add channels one by one in the list below.
        </p>
      </a>
    );
  }

  // Step 2: user has channels but no delivery connection.
  return (
    <div className="nm-raised overflow-hidden rounded-2xl p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-4">
          <div className="nm-inset flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
            <Check className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-base font-semibold">
              Channels added. Now choose where to get your summaries.
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              Pick a platform to receive every new summary automatically.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pl-16">
          <a
            href="/api/connect/discord"
            className="nm-raised-sm text-foreground rounded-full px-4 py-2 text-sm font-medium transition-all hover:brightness-110"
          >
            Discord
          </a>
          <a
            href="/api/connect/slack"
            className="nm-raised-sm text-foreground rounded-full px-4 py-2 text-sm font-medium transition-all hover:brightness-110"
          >
            Slack
          </a>
          <button
            onClick={openTelegramDialog}
            className="nm-raised-sm text-foreground rounded-full px-4 py-2 text-sm font-medium transition-all hover:brightness-110"
          >
            Telegram
          </button>
          <button
            onClick={() => {
              const supabase = createClient();
              void supabase.auth.getUser().then(({ data: { user } }) => {
                if (!user) return;
                void supabase
                  .from("profiles")
                  .update({ onboarding_completed: true })
                  .eq("id", user.id)
                  .then(() => setShowTip(true));
              });
            }}
            className="text-muted-foreground hover:text-foreground ml-1 rounded-full px-3 py-2 text-sm transition-colors"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );

  // Tip shown after clicking Skip
  if (showTip) {
    return (
      <div className="nm-raised overflow-hidden rounded-2xl p-6">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold">
            You're all set! Summaries will appear here as new videos come out.
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            You can customize the default summary style, length, and language
            anytime in{" "}
            <a
              href="/dashboard/profile"
              className="text-foreground underline underline-offset-2"
            >
              Profile settings
            </a>
            . You can also set different preferences for each channel
            individually from the channel menu.
          </p>
          <button
            onClick={() => {
              setShowTip(false);
              router.refresh();
            }}
            className="text-muted-foreground hover:text-foreground self-end text-xs transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    );
  }
}
