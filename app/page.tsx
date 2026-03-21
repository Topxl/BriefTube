import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { Suspense } from "react";
import { Hero } from "@/components/landing/hero";
import { Navbar } from "@/components/landing/navbar";
import { SocialProof } from "@/components/landing/social-proof";
import { SiteConfig } from "@/site-config";

const Problem = dynamic(async () =>
  import("@/components/landing/problem").then((m) => ({ default: m.Problem })),
);
const HowItWorks = dynamic(async () =>
  import("@/components/landing/how-it-works").then((m) => ({
    default: m.HowItWorks,
  })),
);
const Demo = dynamic(async () =>
  import("@/components/landing/demo").then((m) => ({ default: m.Demo })),
);
const Features = dynamic(async () =>
  import("@/components/landing/features").then((m) => ({
    default: m.Features,
  })),
);
const Pricing = dynamic(async () =>
  import("@/components/landing/pricing").then((m) => ({ default: m.Pricing })),
);
const FAQ = dynamic(async () =>
  import("@/components/landing/faq").then((m) => ({ default: m.FAQ })),
);
const FinalCTA = dynamic(async () =>
  import("@/components/landing/final-cta").then((m) => ({
    default: m.FinalCTA,
  })),
);
const Footer = dynamic(async () =>
  import("@/components/landing/footer").then((m) => ({ default: m.Footer })),
);

export const metadata: Metadata = {
  title: {
    absolute:
      "BriefTube | YouTube Summaries as Audio for Telegram, Discord & Slack",
  },
  description:
    "BriefTube monitors your YouTube channels and delivers a short audio summary for every new video, straight to Telegram, Discord or Slack. Free for up to 5 channels. No watching required.",
  alternates: {
    canonical: SiteConfig.prodUrl,
  },
  openGraph: {
    title:
      "BriefTube | YouTube Summaries as Audio for Telegram, Discord & Slack",
    description:
      "Stop falling behind on your YouTube channels. BriefTube turns every new video into a short audio brief and delivers it automatically to Telegram, Discord or Slack. Free for 5 channels.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "BriefTube — YouTube audio summaries delivered to Telegram, Discord and Slack",
      },
    ],
  },
  twitter: {
    title:
      "BriefTube | YouTube Summaries as Audio for Telegram, Discord & Slack",
    description:
      "Stop falling behind on your YouTube channels. BriefTube turns every new video into a short audio brief and delivers it automatically to Telegram, Discord or Slack. Free for 5 channels.",
  },
};

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SiteConfig.title,
    url: SiteConfig.prodUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SiteConfig.prodUrl}/channels?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SiteConfig.title,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web Browser",
    description: SiteConfig.description,
    url: SiteConfig.prodUrl,
    image: `${SiteConfig.prodUrl}/logo-hd.png`,
    featureList: [
      "AI-powered YouTube video summarization",
      "Text-to-speech audio conversion",
      "Automatic delivery to Telegram, Discord or Slack",
      "Multi-language support",
      "Monitor up to 5 channels for free",
    ],
    offers: [
      {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        name: "Free",
        availability: "https://schema.org/InStock",
        url: `${SiteConfig.prodUrl}/pricing`,
      },
      {
        "@type": "Offer",
        price: "9",
        priceCurrency: "USD",
        name: "Pro",
        availability: "https://schema.org/InStock",
        url: `${SiteConfig.prodUrl}/pricing`,
      },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SiteConfig.title,
    url: SiteConfig.prodUrl,
    logo: `${SiteConfig.prodUrl}/logo-hd.png`,
    email: "contact@brief-tube.com",
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "contact@brief-tube.com",
    },
    sameAs: ["https://t.me/brief_tube_bot", "https://twitter.com/brieftube"],
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How does BriefTube actually work?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Each channel you follow gets checked automatically through YouTube's RSS feed. The moment a new video appears, BriefTube reads its transcript, generates a summary, converts it to audio, and sends it to your Telegram — usually within a few minutes. No manual steps on your end.",
        },
      },
      {
        "@type": "Question",
        name: "Which languages work?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "French and English voices are available right now. More are in the pipeline. If you're on Pro, you can pick a specific voice — there are a few to choose from in each language.",
        },
      },
      {
        "@type": "Question",
        name: "Do I need to set up a Telegram bot?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. You click a connect link, it opens @brief_tube_bot in Telegram, you send /start. That's the whole process — maybe 15 seconds if you type slowly.",
        },
      },
      {
        "@type": "Question",
        name: "What happens if I cancel?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "You drop back to the free plan — your channels stay, your history stays, you just lose access to the Pro features. No cancellation fees, no awkward retention flows.",
        },
      },
    ],
  },
];

export default function Home() {
  return (
    <main className="bg-background min-h-screen">
      {jsonLd.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      {/* Preload LCP image — WebP, local file served from same CDN, no external fetch */}
      <link
        rel="preload"
        as="image"
        href="/demo-thumb-1.webp"
        fetchPriority="high"
      />
      <Navbar />
      <Hero />
      <Suspense fallback={<div className="h-16" />}>
        <SocialProof />
      </Suspense>
      <div className="section-divider" />
      <Suspense fallback={<div className="h-64" />}>
        <Problem />
      </Suspense>
      <Suspense fallback={<div className="h-64" />}>
        <HowItWorks />
      </Suspense>
      <div className="section-divider" />
      <Suspense fallback={<div className="h-64" />}>
        <Demo />
      </Suspense>
      <div className="section-divider" />
      <Suspense fallback={<div className="h-64" />}>
        <Features />
      </Suspense>
      <Suspense fallback={<div className="h-64" />}>
        <Pricing />
      </Suspense>
      <div className="section-divider" />
      <Suspense fallback={<div className="h-64" />}>
        <FAQ />
      </Suspense>
      <Suspense fallback={<div className="h-32" />}>
        <FinalCTA />
      </Suspense>
      <Suspense fallback={<div className="h-32" />}>
        <Footer />
      </Suspense>
    </main>
  );
}
