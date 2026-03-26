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
          <Image
            src="/logo.svg"
            alt="BriefTube"
            width={32}
            height={32}
            priority
            suppressHydrationWarning
          />
          <span className="text-lg font-semibold">BriefTube</span>
        </Link>

        <div className="text-muted-foreground hidden items-center gap-1 text-sm md:flex">
          <Link
            href="/#how-it-works"
            className="hover:text-foreground rounded-full px-3 py-1.5 transition-colors duration-150 hover:bg-white/[0.06]"
          >
            {tl.howItWorks}
          </Link>
          <Link
            href="/#features"
            className="hover:text-foreground rounded-full px-3 py-1.5 transition-colors duration-150 hover:bg-white/[0.06]"
          >
            {tl.features}
          </Link>
          <Link
            href="/#pricing"
            className="hover:text-foreground rounded-full px-3 py-1.5 transition-colors duration-150 hover:bg-white/[0.06]"
          >
            {tl.pricing}
          </Link>
          <Link
            href="/#faq"
            className="hover:text-foreground rounded-full px-3 py-1.5 transition-colors duration-150 hover:bg-white/[0.06]"
          >
            {tl.faq}
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-3 md:flex">
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
