import { Hero } from "@/components/landing/hero";
import { Problem } from "@/components/landing/problem";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Demo } from "@/components/landing/demo";
import { Features } from "@/components/landing/features";
import { Pricing } from "@/components/landing/pricing";
import { FAQ } from "@/components/landing/faq";
import { FinalCTA } from "@/components/landing/final-cta";
import { Footer } from "@/components/landing/footer";
import { Navbar } from "@/components/landing/navbar";
import type { Metadata } from "next";
import { SiteConfig } from "@/site-config";

export const metadata: Metadata = {
  alternates: {
    canonical: SiteConfig.prodUrl,
  },
};

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SiteConfig.title,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web, Telegram",
    description: SiteConfig.description,
    url: SiteConfig.prodUrl,
    offers: [
      {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        name: "Free",
      },
      {
        "@type": "Offer",
        price: "9",
        priceCurrency: "USD",
        name: "Pro",
        billingIncrement: "P1M",
      },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SiteConfig.title,
    url: SiteConfig.prodUrl,
    logo: `${SiteConfig.prodUrl}/images/icon.png`,
    sameAs: [`https://t.me/brief_tube_bot`],
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How does BriefTube work?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "BriefTube monitors YouTube RSS feeds for new videos from your subscribed channels. When a new video is detected, our AI generates a detailed summary, converts it to natural-sounding audio, and sends it directly to your Telegram.",
        },
      },
      {
        "@type": "Question",
        name: "What languages are supported?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "We currently support French and English voices, with more languages coming soon. Pro users can choose their preferred voice from our selection.",
        },
      },
      {
        "@type": "Question",
        name: "Do I need to create a Telegram bot?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. You simply connect your Telegram account by clicking a link and sending a message to our @brief_tube_bot. It takes 10 seconds.",
        },
      },
      {
        "@type": "Question",
        name: "What if I want to cancel?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Cancel anytime from your dashboard. No questions asked, no cancellation fees. Your free tier access remains active.",
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
      <Navbar />
      <Hero />
      <div className="section-divider" />
      <Problem />
      <HowItWorks />
      <div className="section-divider" />
      <Demo />
      <div className="section-divider" />
      <Features />
      <Pricing />
      <div className="section-divider" />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}
