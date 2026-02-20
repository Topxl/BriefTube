import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { LandingMobileNav } from "@/components/landing/mobile-nav";
import { t } from "@/locales";

const tl = t.landing.nav;

export function Navbar() {
  return (
    <nav className="fixed top-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-6xl -translate-x-1/2 rounded-2xl border border-white/[0.06] bg-white/[0.04] shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
      <div className="flex h-14 items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.svg" alt="BriefTube" width={32} height={32} suppressHydrationWarning />
          <span className="text-lg font-semibold">BriefTube</span>
        </Link>

        <div className="text-muted-foreground hidden items-center gap-1 text-sm md:flex">
          <a
            href="#how-it-works"
            className="hover:text-foreground relative rounded-full px-3 py-1.5 transition-all duration-300 after:absolute after:bottom-0 after:left-1/2 after:h-px after:w-0 after:-translate-x-1/2 after:bg-red-500 after:transition-all after:duration-300 hover:bg-white/[0.06] hover:after:w-2/3"
          >
            {tl.howItWorks}
          </a>
          <a
            href="#features"
            className="hover:text-foreground relative rounded-full px-3 py-1.5 transition-all duration-300 after:absolute after:bottom-0 after:left-1/2 after:h-px after:w-0 after:-translate-x-1/2 after:bg-red-500 after:transition-all after:duration-300 hover:bg-white/[0.06] hover:after:w-2/3"
          >
            {tl.features}
          </a>
          <a
            href="#pricing"
            className="hover:text-foreground relative rounded-full px-3 py-1.5 transition-all duration-300 after:absolute after:bottom-0 after:left-1/2 after:h-px after:w-0 after:-translate-x-1/2 after:bg-red-500 after:transition-all after:duration-300 hover:bg-white/[0.06] hover:after:w-2/3"
          >
            {tl.pricing}
          </a>
          <a
            href="#faq"
            className="hover:text-foreground relative rounded-full px-3 py-1.5 transition-all duration-300 after:absolute after:bottom-0 after:left-1/2 after:h-px after:w-0 after:-translate-x-1/2 after:bg-red-500 after:transition-all after:duration-300 hover:bg-white/[0.06] hover:after:w-2/3"
          >
            {tl.faq}
          </a>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-3 md:flex">
            <a
              href="https://github.com/Topxl/BriefTube"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-sm transition-all duration-300 hover:bg-white/[0.08]"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              {tl.star}
            </a>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">{tl.logIn}</Link>
            </Button>
            <Button
              size="sm"
              className="bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.25)] hover:bg-red-500"
              asChild
            >
              <Link href="/login">{tl.startFree}</Link>
            </Button>
          </div>
          <LandingMobileNav />
        </div>
      </div>
    </nav>
  );
}
