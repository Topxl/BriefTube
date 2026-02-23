import Link from "next/link";
import { Button } from "@/components/ui/button";

type LpHeroProps = {
  headline: string;
  subheadline: string;
  ctaLabel: string;
  ctaHref: string;
  trustLine: string;
};

export function LpHero({
  headline,
  subheadline,
  ctaLabel,
  ctaHref,
  trustLine,
}: LpHeroProps) {
  return (
    <section className="relative overflow-hidden pt-36 pb-14 md:pt-52 md:pb-20">
      {/* Gradient background orbs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute top-0 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-red-600/15 blur-[150px]"
          style={{ animation: "orb-drift 20s ease-in-out infinite" }}
        />
        <div
          className="absolute top-1/3 right-0 h-[400px] w-[400px] rounded-full bg-blue-500/12 blur-[150px]"
          style={{ animation: "orb-drift 25s ease-in-out infinite reverse" }}
        />
      </div>

      <div className="mx-auto max-w-4xl px-6 text-center">
        <h1 className="font-display text-4xl leading-tight font-bold tracking-tight md:text-6xl md:leading-[1.1]">
          {headline}
        </h1>

        <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg md:text-xl">
          {subheadline}
        </p>

        <div className="mt-10 flex flex-col items-center gap-3">
          <Button
            size="lg"
            className="h-12 bg-red-600 px-8 text-base shadow-[0_0_30px_rgba(239,68,68,0.3)] transition-all duration-300 hover:bg-red-500 hover:shadow-[0_0_40px_rgba(239,68,68,0.4)]"
            asChild
          >
            <Link href={ctaHref}>{ctaLabel}</Link>
          </Button>
          <p className="text-muted-foreground text-sm">{trustLine}</p>
        </div>
      </div>
    </section>
  );
}
