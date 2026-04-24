import Link from "next/link";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { t } from "@/locales";
import { HeroUrlInput } from "./hero-url-input";

// HeroPlayer lives below the fold and carries the big demo-summary blobs +
// audio state. Keep it out of the initial JS bundle to speed up LCP/TBT.
const HeroPlayer = dynamic(async () =>
  import("./hero-player").then((m) => ({ default: m.HeroPlayer })),
);

const tl = t.landing.hero;

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-24 pb-10 md:pt-44 md:pb-32">
      {/* Gradient background orbs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-red-600/15 blur-[60px] md:blur-[80px]" />
        <div className="absolute top-1/3 right-0 hidden h-[400px] w-[400px] rounded-full bg-blue-500/12 blur-[60px] md:block" />
        <div className="absolute bottom-0 left-0 hidden h-[350px] w-[350px] rounded-full bg-violet-500/10 blur-[60px] md:block" />
      </div>

      <div className="mx-auto max-w-4xl px-5 text-center">
        {/* ================================================================
            MOBILE HERO: compact, URL-input-first
            ================================================================ */}
        <div className="md:hidden">
          <h1 className="text-[28px] leading-[1.2] font-bold tracking-tight">
            Paste a YouTube link.
            <br />
            <span className="bg-gradient-to-r from-red-500 to-orange-400 bg-clip-text text-transparent">
              Get the AI summary.
            </span>
          </h1>

          <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
            Every new video, summarized and turned into audio. Delivered to
            Telegram, Discord, or your podcast app.
          </p>

          <div className="mt-6">
            <HeroUrlInput />
          </div>

          <p className="text-muted-foreground mt-4 text-xs">{tl.socialProof}</p>

          {/* Demo player (optional on mobile, more compact) */}
          <div className="mt-8">
            <HeroPlayer />
          </div>
        </div>

        {/* ================================================================
            DESKTOP HERO: full layout with URL input added
            ================================================================ */}
        <div className="hidden md:block">
          <h1 className="font-display text-6xl leading-[1.1] font-bold tracking-tight">
            {tl.heading}{" "}
            <span className="bg-gradient-to-r from-red-500 to-orange-400 bg-clip-text text-transparent">
              {tl.headingHighlight}
            </span>
          </h1>

          <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-xl">
            {tl.subtitle}
          </p>

          <div className="mt-10">
            <HeroUrlInput />
          </div>

          <div className="mt-6 flex items-center justify-center">
            <Button
              size="lg"
              className="h-12 bg-red-600 px-8 text-base shadow-[0_0_30px_rgba(239,68,68,0.3)] transition-all duration-300 hover:bg-red-500 hover:shadow-[0_0_40px_rgba(239,68,68,0.4)]"
              asChild
            >
              <Link href="/login">{tl.ctaPrimary}</Link>
            </Button>
          </div>

          <p className="text-muted-foreground mt-4 text-sm">{tl.socialProof}</p>
          <p className="mt-1 text-sm font-medium text-green-500">
            {tl.postTrialNote}
          </p>

          <HeroPlayer />
        </div>
      </div>
    </section>
  );
}
