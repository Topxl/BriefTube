import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SiteConfig } from "@/site-config";
import { PricingCards } from "@/components/pricing/pricing-cards";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Start free with 5 YouTube channels, or go Pro for unlimited channels, priority processing and custom voices. Simple, transparent pricing.",
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
      description:
        "Start free with 5 YouTube channels. Upgrade to Pro for unlimited channels, priority processing, and custom voices.",
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
        <h1 className="text-3xl font-bold">Choose Your Plan</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Simple pricing. Upgrade or cancel anytime.
        </p>
      </div>
      <PricingCards isLoggedIn={!!user} isPro={isPro} />
    </div>
  );
}
