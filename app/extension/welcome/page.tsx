import Link from "next/link";
import {
  BookmarkPlus,
  CheckCircle2,
  Clock,
  Headphones,
  Languages,
  Shield,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Welcome to the BriefTube extension",
  description:
    "You just installed the BriefTube Chrome extension. Here's how to get the most out of it.",
};

export default function ExtensionWelcomePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-red-600 shadow-lg">
          <Zap className="size-7 text-white" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">
          The extension is installed
        </h1>
        <p className="text-muted-foreground max-w-xl">
          Open any YouTube video and the BriefTube sidebar will appear on the
          right. No account needed to try it: 3 free summaries per day, forever,
          with no credit card.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Feature
          icon={Clock}
          title="3 free per day, no account"
          body="Try the extension without signing in or entering a credit card. No dark patterns."
        />
        <Feature
          icon={CheckCircle2}
          title="Sign in for 10/day free"
          body="Google sign-in (still no card) bumps your daily quota and syncs summaries to your BriefTube dashboard."
        />
        <Feature
          icon={BookmarkPlus}
          title="One-click channel subscribe"
          body="Hit 'Subscribe channel' and BriefTube will auto-summarize every new upload on Telegram, Discord, or email."
        />
        <Feature
          icon={Headphones}
          title="Audio summaries (Pro)"
          body="Listen to video digests on the go with natural Edge TTS voices, a feature no other extension offers."
        />
        <Feature
          icon={Languages}
          title="15+ languages"
          body="Summaries can be translated to your preferred language regardless of the video's source language."
        />
        <Feature
          icon={Shield}
          title="Privacy first"
          body="Minimal permissions: only YouTube and brief-tube.com. Nothing runs in the background."
        />
      </div>

      <div className="mt-10 flex flex-col items-center gap-3">
        <Button asChild size="lg">
          <Link
            href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
            target="_blank"
          >
            Open a YouTube video to test
          </Link>
        </Button>
        <Link
          href="/dashboard"
          className="text-muted-foreground text-sm hover:underline"
        >
          Open my BriefTube dashboard →
        </Link>
      </div>
    </div>
  );
}

function Feature(props: { icon: typeof Clock; title: string; body: string }) {
  const Icon = props.icon;
  return (
    <div className="bg-card flex flex-col gap-2 rounded-xl border p-4">
      <div className="bg-muted flex size-9 items-center justify-center rounded-lg">
        <Icon className="size-4" />
      </div>
      <h3 className="text-sm font-semibold">{props.title}</h3>
      <p className="text-muted-foreground text-sm">{props.body}</p>
    </div>
  );
}
