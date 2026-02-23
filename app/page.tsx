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
