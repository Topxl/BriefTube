import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SiteConfig } from "@/site-config";
import { PricingCards } from "@/components/pricing/pricing-cards";

export const metadata: Metadata = {
  title: "Pricing",
  description: `Start free with ${SiteConfig.freeChannelsLimit} YouTube channels, upgrade to Plus for ${SiteConfig.plusChannelsLimit} channels, or go Pro for unlimited channels, priority processing and custom voices. Simple, transparent pricing.`,
  alternates: {
    canonical: `${SiteConfig.prodUrl}/pricing`,
  },
};

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isPro = false;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_status")
      .eq("id", user.id)
      .single();

    isPro = profile?.subscription_status === "active";
  }

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "BriefTube Pricing",
      url: `${SiteConfig.prodUrl}/pricing`,
      description: `Start free with ${SiteConfig.freeChannelsLimit} YouTube channels. Upgrade to Pro for unlimited channels, priority processing, and custom voices.`,
      isPartOf: {
        "@type": "WebSite",
        name: SiteConfig.title,
        url: SiteConfig.prodUrl,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: SiteConfig.prodUrl,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Pricing",
          item: `${SiteConfig.prodUrl}/pricing`,
        },
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-10 text-center">
        {jsonLd.map((schema, i) => (
          <script
            key={i}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
          />
        ))}
        <h1 className="text-3xl font-bold">Simple pricing, no catch</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {`Free forever for ${SiteConfig.freeChannelsLimit} channels. Upgrade when you want more.`}
        </p>
      </div>
      <PricingCards isLoggedIn={!!user} isPro={isPro} />

      {/* Pricing explainer */}
      <div className="mt-16 flex flex-col gap-10 border-t border-white/[0.06] pt-12">
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">
            What does the free plan include?
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {`The free plan lets you monitor up to ${SiteConfig.freeChannelsLimit} YouTube channels with no credit card and no time limit. Every new video from those channels gets summarized automatically by AI, converted to audio, and delivered to your dashboard, private podcast RSS feed, Telegram, Discord, or Slack. There is no catch and no feature artificially locked. The free plan is genuinely usable.`}
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">What does Plus add?</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {`Plus increases your channel limit from ${SiteConfig.freeChannelsLimit} to ${SiteConfig.plusChannelsLimit} YouTube channels. It also gives you priority processing: your summaries are generated before free-plan requests, so they arrive faster. Plus is perfect if you follow dozens of channels but don't need unlimited.`}
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">What does Pro add?</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Pro removes the channel limit entirely. You can follow as many
            YouTube channels as you want. On top of Plus features, Pro gives you
            the ability to choose a specific voice from several neural TTS
            options per language, and early access to new features before they
            roll out to everyone.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">
            What does priority processing mean in practice?
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            When a new video is published on a channel you follow, BriefTube
            queues it for processing. On the free plan, your request is
            processed in standard order. On Pro, your request jumps ahead in the
            queue. In practice this means Pro summaries typically arrive within
            a few minutes of a video going live, while free-plan summaries may
            take up to 30 minutes during busy periods.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">What happens if I cancel?</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            If you cancel, you drop back to the free plan at the end of your
            billing period. Your channels stay, your summary history stays, you
            just lose access to the Pro features. No cancellation fees, no
            awkward retention flows, no data deleted. You can re-subscribe at
            any time.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">
            {`Is the ${SiteConfig.trialDays}-day trial really free?`}
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {`Yes. No credit card required to start. When you sign up, you automatically get ${SiteConfig.trialDays} days of Pro features at no cost. At the end of the trial, you can enter a card to continue on Pro, or keep using the free plan with no action needed. You will never be charged without explicitly providing payment details.`}
          </p>
        </section>
      </div>
    </div>
  );
}
