import { type LandingVariant } from "@/content/landing-variants";
import { LpNavbar } from "@/components/lp/lp-navbar";
import { LpHero } from "@/components/lp/lp-hero";
import { LpProofBar } from "@/components/lp/lp-proof-bar";
import { LpPainCards } from "@/components/lp/lp-pain-cards";
import { LpHowItWorks } from "@/components/lp/lp-how-it-works";
import { LpBottomCta } from "@/components/lp/lp-bottom-cta";
import { LpFooter } from "@/components/lp/lp-footer";

type LandingVariantPageProps = {
  variant: LandingVariant;
};

export function LandingVariantPage({ variant }: LandingVariantPageProps) {
  const ctaHref = `/login?utm_source=lp&utm_campaign=${variant.slug}`;

  return (
    <div className="min-h-screen">
      <LpNavbar ctaLabel={variant.hero.ctaLabel} ctaHref={ctaHref} />

      <LpHero
        headline={variant.hero.headline}
        subheadline={variant.hero.subheadline}
        ctaLabel={variant.hero.ctaLabel}
        ctaHref={ctaHref}
        trustLine={variant.hero.trustLine}
      />

      <LpProofBar stats={variant.proofStats} />

      <div className="mx-auto max-w-6xl px-6">
        <hr className="border-white/[0.06]" />
      </div>

      <LpPainCards painPoints={variant.painPoints} />

      <div className="mx-auto max-w-6xl px-6">
        <hr className="border-white/[0.06]" />
      </div>

      <LpHowItWorks steps={variant.steps} />

      <div className="mx-auto max-w-6xl px-6">
        <hr className="border-white/[0.06]" />
      </div>

      <LpBottomCta
        headline={variant.bottomCta.headline}
        subheadline={variant.bottomCta.subheadline}
        ctaLabel={variant.bottomCta.ctaLabel}
        ctaHref={ctaHref}
        urgencyNote={variant.bottomCta.urgencyNote}
      />

      <LpFooter />
    </div>
  );
}
