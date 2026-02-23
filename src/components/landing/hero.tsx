import Link from "next/link";
import { Button } from "@/components/ui/button";
import { t } from "@/locales";

const tl = t.landing.hero;

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-20 pb-20 md:pt-44 md:pb-32">
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
        <div
          className="absolute bottom-0 left-0 h-[350px] w-[350px] rounded-full bg-violet-500/10 blur-[150px]"
          style={{ animation: "orb-drift 22s ease-in-out infinite 5s" }}
        />
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

        {/* Telegram mockup */}
        <div
          className="mx-auto mt-16 max-w-sm"
          style={{ animation: "float 6s ease-in-out infinite" }}
        >
          <div className="nm-raised rounded-2xl p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 shadow-[0_0_16px_rgba(239,68,68,0.3)]">
                <svg
                  width="22"
                  height="18"
                  viewBox="0 0 20 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M0 0L9 8L0 16V0Z" fill="white" />
                  <path d="M11 0L20 8L11 16V0Z" fill="white" opacity="0.85" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-medium">BriefTube</p>
                <p className="text-muted-foreground text-xs">
                  {tl.mockupBotRole}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="nm-inset rounded-xl p-3">
                <p className="text-muted-foreground text-xs font-medium">
                  {tl.mockupVideo1Channel}
                </p>
                <p className="text-sm font-medium">{tl.mockupVideo1Title}</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="nm-raised-sm flex h-8 w-8 items-center justify-center rounded-full bg-red-600/[0.15] text-red-400">
                    <svg
                      className="h-4 w-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                    </svg>
                  </div>
                  <div className="h-1 flex-1 rounded-full bg-white/[0.08]">
                    <div className="h-1 w-2/3 rounded-full bg-red-500" />
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {tl.mockupVideo1Duration}
                  </span>
                </div>
              </div>
              <div className="nm-inset rounded-xl p-3">
                <p className="text-muted-foreground text-xs font-medium">
                  {tl.mockupVideo2Channel}
                </p>
                <p className="text-sm font-medium">{tl.mockupVideo2Title}</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="nm-raised-sm flex h-8 w-8 items-center justify-center rounded-full bg-red-600/[0.15] text-red-400">
                    <svg
                      className="h-4 w-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                    </svg>
                  </div>
                  <div className="h-1 flex-1 rounded-full bg-white/[0.08]">
                    <div className="h-1 w-1/3 rounded-full bg-red-500" />
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {tl.mockupVideo2Duration}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
