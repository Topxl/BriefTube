import Link from "next/link";
import { Button } from "@/components/ui/button";

type LpBottomCtaProps = {
  headline: string;
  subheadline: string;
  ctaLabel: string;
  ctaHref: string;
  urgencyNote?: string;
};

export function LpBottomCta({
  headline,
  subheadline,
  ctaLabel,
  ctaHref,
  urgencyNote,
}: LpBottomCtaProps) {
  return (
    <section className="relative overflow-hidden py-20 md:py-28">
      {/* Red orb */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute bottom-0 left-1/2 h-[500px] w-[500px] -translate-x-1/2 translate-y-1/2 rounded-full bg-red-600/20 blur-[150px]" />
      </div>

      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="font-display text-3xl font-bold md:text-4xl">
          {headline}
        </h2>
        <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-lg">
          {subheadline}
        </p>

        <div className="mt-8 flex flex-col items-center gap-3">
          <Button
            size="lg"
            className="h-12 bg-red-600 px-8 text-base shadow-[0_0_30px_rgba(239,68,68,0.3)] transition-all duration-300 hover:bg-red-500 hover:shadow-[0_0_40px_rgba(239,68,68,0.4)]"
            asChild
          >
            <Link href={ctaHref}>{ctaLabel}</Link>
          </Button>
          {urgencyNote && (
            <p className="text-muted-foreground text-sm">{urgencyNote}</p>
          )}
        </div>
      </div>
    </section>
  );
}
