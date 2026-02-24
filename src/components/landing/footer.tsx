import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import { NewsletterForm } from "@/components/landing/newsletter-form";

export async function Footer() {
  await headers();

  return (
    <footer className="border-t border-white/[0.06] bg-white/[0.02] backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-6 py-12">
        {/* Top row */}
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          {/* Brand */}
          <div className="flex flex-col gap-3">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/logo.svg"
                alt="BriefTube"
                width={28}
                height={28}
                suppressHydrationWarning
              />
              <span className="text-base font-semibold">BriefTube</span>
            </Link>
            <p className="text-muted-foreground max-w-[220px] text-sm leading-relaxed">
              YouTube videos, summarized as audio, delivered to your Telegram.
            </p>
          </div>

          {/* Links */}
          <div className="flex gap-12">
            <div className="flex flex-col gap-3">
              <p className="text-xs font-medium tracking-wide text-white/40 uppercase">
                Product
              </p>
              <div className="text-muted-foreground flex flex-col gap-2 text-sm">
                <Link
                  href="/#how-it-works"
                  className="hover:text-foreground transition-colors"
                >
                  How it works
                </Link>
                <Link
                  href="/#features"
                  className="hover:text-foreground transition-colors"
                >
                  Features
                </Link>
                <Link
                  href="/#pricing"
                  className="hover:text-foreground transition-colors"
                >
                  Pricing
                </Link>
                <Link
                  href="/support"
                  className="hover:text-foreground transition-colors"
                >
                  Support
                </Link>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <p className="text-xs font-medium tracking-wide text-white/40 uppercase">
                Legal
              </p>
              <div className="text-muted-foreground flex flex-col gap-2 text-sm">
                <Link
                  href="/privacy"
                  className="hover:text-foreground transition-colors"
                >
                  Privacy
                </Link>
                <Link
                  href="/terms"
                  className="hover:text-foreground transition-colors"
                >
                  Terms
                </Link>
              </div>
            </div>
          </div>

          {/* Newsletter */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium tracking-wide text-white/40 uppercase">
              Stay updated
            </p>
            <p className="text-muted-foreground text-sm">
              Get product updates and tips.
            </p>
            <NewsletterForm />
          </div>
        </div>

        {/* Bottom row */}
        <div className="text-muted-foreground mt-10 border-t border-white/[0.04] pt-6 text-xs">
          © {new Date().getFullYear()} BriefTube. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
