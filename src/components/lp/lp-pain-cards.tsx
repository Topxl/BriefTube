"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

type PainPoint = {
  title: string;
  description: string;
};

type LpPainCardsProps = {
  painPoints: [PainPoint, PainPoint, PainPoint];
};

const painIcons = [
  <svg
    key="clock"
    className="h-6 w-6"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>,
  <svg
    key="inbox"
    className="h-6 w-6"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z"
    />
  </svg>,
  <svg
    key="bolt"
    className="h-6 w-6"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
    />
  </svg>,
];

export function LpPainCards({ painPoints }: LpPainCardsProps) {
  return (
    <section className="py-14 md:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <ScrollReveal>
          <h2 className="font-display text-center text-2xl font-bold md:text-3xl">
            Sound familiar?
            <br />
            <span className="text-muted-foreground">
              Most YouTube tools don&apos;t solve this.
            </span>
          </h2>
        </ScrollReveal>

        <ScrollReveal delay={150}>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {painPoints.map((point, i) => (
              <Card
                key={point.title}
                className="hover:-translate-y-0.5 hover:border-white/[0.12] hover:shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
              >
                <CardContent className="pt-6">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.06] text-red-500 backdrop-blur-sm">
                    {painIcons[i]}
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">{point.title}</h3>
                  <p className="text-muted-foreground text-sm">
                    {point.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
