import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

type LpNavbarProps = {
  ctaLabel: string;
  ctaHref: string;
};

export function LpNavbar({ ctaLabel, ctaHref }: LpNavbarProps) {
  return (
    <nav className="fixed top-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-6xl -translate-x-1/2 rounded-2xl border border-white/[0.06] bg-white/[0.04] shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
      <div className="flex h-14 items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logo.svg"
            alt="BriefTube"
            width={32}
            height={32}
            suppressHydrationWarning
          />
          <span className="text-lg font-semibold">BriefTube</span>
        </Link>

        <Button
          size="sm"
          className="bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.25)] hover:bg-red-500"
          asChild
        >
          <Link href={ctaHref}>{ctaLabel}</Link>
        </Button>
      </div>
    </nav>
  );
}
