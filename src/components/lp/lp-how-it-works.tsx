"use client";

import { ScrollReveal } from "@/components/ui/scroll-reveal";

type Step = {
  title: string;
  description: string;
};

type LpHowItWorksProps = {
  steps: [Step, Step, Step];
};

export function LpHowItWorks({ steps }: LpHowItWorksProps) {
  return (
    <section className="py-14 md:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <ScrollReveal>
          <h2 className="font-display text-center text-2xl font-bold md:text-3xl">
            How it works
          </h2>
        </ScrollReveal>

        <ScrollReveal delay={150}>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {steps.map((step, i) => (
              <div key={step.title} className="flex flex-col gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.06] text-sm font-bold text-red-500">
                  {i + 1}
                </div>
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="text-muted-foreground text-sm">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
