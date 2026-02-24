"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { t } from "@/locales";

const tl = t.landing.finalCta;

export function FinalCTA() {
  return (
    <section className="relative overflow-hidden py-14 md:py-20">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600/8 blur-[150px]" />
      </div>

      <div className="mx-auto max-w-2xl px-6 text-center">
        <ScrollReveal>
          <h2 className="font-display text-2xl font-bold md:text-3xl">
            {tl.heading}
          </h2>
          <p className="text-muted-foreground mt-4">{tl.subtitle}</p>
        </ScrollReveal>
        <ScrollReveal delay={150}>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              className="h-12 bg-red-600 px-8 text-base shadow-[0_0_30px_rgba(239,68,68,0.3)] hover:bg-red-500"
              asChild
            >
              <Link href="/login">{tl.ctaPrimary}</Link>
            </Button>
          </div>
          <p className="text-muted-foreground mt-4 text-xs">
            {tl.loginText}{" "}
            <Link href="/login" className="hover:text-foreground underline">
              {tl.loginLink}
            </Link>
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
