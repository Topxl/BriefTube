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
    <div className="mx-auto flex min-h-[100dvh] max-w-4xl flex-col justify-center px-4 py-6 sm:px-6 md:py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-red-600 shadow-lg">
          <Zap className="size-5 text-white" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          The extension is installed
        </h1>
        <p className="text-muted-foreground max-w-xl text-sm md:text-base">
          Open any YouTube video and the BriefTube sidebar will appear on the
          right. 3 free summaries per day, forever, with no credit card.
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 md:mt-8 lg:grid-cols-3">
        <Feature
          icon={Clock}
          title="3 free per day, no account"
          body="Try the extension without signing in or entering a credit card."
        />
        <Feature
          icon={CheckCircle2}
          title="Sign in for 10/day free"
          body="Google sign-in (still no card) bumps your quota and syncs to your dashboard."
        />
        <Feature
          icon={BookmarkPlus}
          title="One-click channel subscribe"
          body="Auto-summarize every new upload on Telegram, Discord, or email."
        />
        <Feature
          icon={Headphones}
          title="Audio summaries (Pro)"
          body="Listen to video digests on the go with natural Edge TTS voices."
        />
        <Feature
          icon={Languages}
          title="15+ languages"
          body="Summaries translated to your preferred language regardless of the video's source."
        />
        <Feature
          icon={Shield}
          title="Privacy first"
          body="Minimal permissions: only YouTube and brief-tube.com."
        />
      </div>

      <div className="mt-6 flex flex-col items-center gap-2 md:mt-8">
        <Button asChild size="lg">
          <Link
            href="https://www.youtube.com/watch?v=nm1TxQj9IsQ"
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
    <div className="bg-card flex flex-col gap-1.5 rounded-xl border p-3">
      <div className="bg-muted flex size-8 items-center justify-center rounded-lg">
        <Icon className="size-4" />
      </div>
      <h3 className="text-sm font-semibold">{props.title}</h3>
      <p className="text-muted-foreground text-xs leading-relaxed">
        {props.body}
      </p>
    </div>
  );
}
