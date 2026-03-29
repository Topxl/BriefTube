import Link from "next/link";
import { Button } from "@/components/ui/button";
import { t } from "@/locales";
import { HeroPlayer } from "./hero-player";

const tl = t.landing.hero;

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-28 pb-14 md:pt-44 md:pb-32">
      {/* Gradient background orbs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-red-600/15 blur-[60px] md:blur-[80px]" />
        <div className="absolute top-1/3 right-0 h-[400px] w-[400px] rounded-full bg-blue-500/12 blur-[40px] md:blur-[60px]" />
        <div className="absolute bottom-0 left-0 h-[350px] w-[350px] rounded-full bg-violet-500/10 blur-[40px] md:blur-[60px]" />
      </div>

      <div className="mx-auto max-w-4xl px-6 text-center">
        <h1 className="font-display text-4xl leading-tight font-bold tracking-tight md:text-6xl md:leading-[1.1]">
          {tl.heading}{" "}
          <span className="bg-gradient-to-r from-red-500 to-orange-400 bg-clip-text text-transparent">
            {tl.headingHighlight}
          </span>
        </h1>

        <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg md:text-xl">
          {tl.subtitle}
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Button
            size="lg"
            className="h-12 bg-red-600 px-8 text-base shadow-[0_0_30px_rgba(239,68,68,0.3)] transition-all duration-300 hover:bg-red-500 hover:shadow-[0_0_40px_rgba(239,68,68,0.4)]"
            asChild
          >
            <Link href="/login">{tl.ctaPrimary}</Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-12 px-8 text-base"
            asChild
          >
            <a href="#demo">{tl.ctaSecondary}</a>
          </Button>
        </div>

        <p className="text-muted-foreground mt-4 text-sm">{tl.socialProof}</p>
        <p className="mt-1 text-sm font-medium text-green-500">
          {tl.postTrialNote}
        </p>

        {/* Audio player — client component, loads after h1/CTA render */}
        <HeroPlayer />
      </div>
    </section>
  );
}
