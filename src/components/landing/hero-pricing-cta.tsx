"use client";

import Link from "next/link";
import posthog from "posthog-js";
import { Button } from "@/components/ui/button";
import { t } from "@/locales";

const tl = t.landing.hero;

export function HeroPricingCtaDesktop() {
  return (
    <Button
      size="lg"
      variant="outline"
      className="h-12 px-8 text-base"
      onClick={() =>
        posthog.capture("pricing_cta_clicked", { source: "hero_desktop" })
      }
      asChild
    >
      <Link href="/pricing">{tl.ctaPricing}</Link>
    </Button>
  );
}

export function HeroPricingCtaMobile() {
  return (
    <Link
      href="/pricing"
      onClick={() =>
        posthog.capture("pricing_cta_clicked", { source: "hero_mobile" })
      }
      className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
    >
      {tl.ctaPricingMobile} →
    </Link>
  );
}
