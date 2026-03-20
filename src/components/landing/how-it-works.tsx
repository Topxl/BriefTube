import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { t } from "@/locales";

const tl = t.landing.howItWorks;

const stepIcons = [
  <svg
    key="plus"
    className="h-8 w-8"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 4.5v15m7.5-7.5h-15"
    />
  </svg>,
  <svg
    key="spark"
    className="h-8 w-8"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
    />
  </svg>,
  <svg
    key="speaker"
    className="h-8 w-8"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z"
    />
  </svg>,
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-14 md:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <ScrollReveal>
          <h2 className="font-display text-center text-2xl font-bold md:text-3xl">
            {tl.heading}
          </h2>
          <p className="text-muted-foreground mt-3 text-center">
            {tl.subtitle}
          </p>
        </ScrollReveal>

        <ScrollReveal delay={150}>
          <div className="mt-12 grid gap-12 md:mt-16 md:grid-cols-3">
            {tl.steps.map((step, i) => (
              <div key={step.title} className="relative text-center">
                {i < tl.steps.length - 1 && (
                  <div className="absolute top-8 left-[calc(50%+40px)] hidden h-px w-[calc(100%-80px)] bg-gradient-to-r from-white/[0.1] to-white/[0.04] md:block" />
                )}
                <div className="nm-raised mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl text-red-400">
                  {stepIcons[i]}
                </div>
                <div className="mb-2 bg-gradient-to-r from-red-500 to-orange-400 bg-clip-text text-sm font-semibold text-transparent">
                  {tl.stepPrefix} {i + 1}
                </div>
                <h3 className="mb-3 text-lg font-semibold">{step.title}</h3>
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
