"use client";

import { useState } from "react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { t } from "@/locales";
import { usePriceFormatted } from "@/hooks/use-prices";

const tl = t.landing.faq;

export function FAQ() {
  const [open, setOpen] = useState<number | null>(null);
  const proPrice = usePriceFormatted();

  return (
    <section id="faq" className="py-14 md:py-20">
      <div className="mx-auto max-w-2xl px-6">
        <ScrollReveal>
          <h2 className="font-display text-center text-2xl font-bold md:text-3xl">
            {tl.heading}
          </h2>
        </ScrollReveal>

        <ScrollReveal delay={150}>
          <div className="mt-12 space-y-2">
            {tl.items.map((faq, i) => (
              <div
                key={i}
                className="nm-raised rounded-2xl transition-all duration-300 hover:-translate-y-0.5"
              >
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-medium"
                >
                  {i === 1 ? tl.priceQuestionFn(proPrice ?? "…") : faq.question}
                  <svg
                    className={`text-muted-foreground h-4 w-4 shrink-0 transition-transform duration-300 ${
                      open === i ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                    />
                  </svg>
                </button>
                <div
                  className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${
                    open === i ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <div className="text-muted-foreground px-5 pb-4 text-sm">
                    {faq.answer}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
