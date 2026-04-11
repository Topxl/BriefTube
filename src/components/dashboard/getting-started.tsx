"use client";

import { useState } from "react";
import { Check, Youtube, ArrowRight } from "@/lib/icons";
import { createClient } from "@/lib/supabase/client";
import { dialogManager } from "@/features/dialog-manager/dialog-manager";
import { toast } from "sonner";

// -----------------------------------------------------------------
// Main component: 3-step onboarding
//   Step 1: Import YouTube channels (no channels yet)
//   Step 2: Connect a delivery platform (has channels, no connection)
//   Step 3: Customize summary preferences (after skipping step 2)
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
  const [step, setStep] = useState<"platform" | "customize" | "done">(() => {
    if (!hasChannel) return "platform";
    if (hasConnection) return "customize";
    if (onboardingCompleted) return "done";
    return "platform";
  });

  const showFeedbackDialog = () => {
    dialogManager.input({
      title: "One quick question before you go",
      input: {
        label:
          "What's the one thing you'd need BriefTube to do for it to become essential to you?",
        defaultValue: "",
      },
      action: {
        label: "Send",
        onClick: async (value: string | undefined) => {
          if (!value?.trim()) return;
          try {
            // Create a chat conversation + message via existing Léa API
            const convRes = await fetch("/api/chat/conversations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: "{}",
            });
            if (!convRes.ok) throw new Error("conv failed");
            const convData = (await convRes.json()) as {
              conversation: { id: string };
            };
            await fetch("/api/chat/ask", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                conversationId: convData.conversation.id,
                message: `[Onboarding feedback] ${value.trim()}`,
              }),
            });
            toast.success("Thanks for your feedback!");
          } catch {
            toast.error("Could not send feedback");
          }
        },
      },
    });
  };

  // If user already completed onboarding and isn't in a tip flow, hide
  if (step === "done") return null;
  // If channels + connection exist and we're not showing the customize tip
  if (hasChannel && hasConnection && step === "platform") return null;

  // ---- Step 1: No channels yet ----
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

  // ---- Step 3: Customize summary preferences ----
  if (step === "customize") {
    return (
      <div className="nm-raised overflow-hidden rounded-2xl p-6">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-semibold">
              Customize how your summaries sound
            </p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Set your defaults in the profile page. You can also override these
              per channel from the channel menu.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/dashboard/profile"
              className="nm-raised-sm text-foreground rounded-full px-4 py-2 text-sm font-medium transition-all hover:brightness-110"
            >
              Open settings
            </a>
            <button
              onClick={() => {
                setStep("done");
                const supabase = createClient();
                void supabase.auth.getUser().then(({ data: { user } }) => {
                  if (!user) return;
                  void supabase
                    .from("profiles")
                    .update({ onboarding_completed: true })
                    .eq("id", user.id);
                });
                showFeedbackDialog();
              }}
              className="text-muted-foreground hover:text-foreground rounded-full px-3 py-2 text-sm transition-colors"
            >
              Skip, use defaults
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Step 2: Connect a delivery platform ----
  return (
    <div className="nm-raised overflow-hidden rounded-2xl p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-4">
          <div className="nm-inset flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
            <Check className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-base font-semibold">
              Channels added. Get your summaries delivered.
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              Connect a platform to receive every new summary automatically.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/dashboard/profile"
            className="nm-raised-sm text-foreground rounded-full px-4 py-2 text-sm font-medium transition-all hover:brightness-110"
          >
            Connect a platform
          </a>
          <button
            onClick={() => setStep("customize")}
            className="text-muted-foreground hover:text-foreground rounded-full px-3 py-2 text-sm transition-colors"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
