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

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SiteConfig.title,
  applicationCategory: "UtilitiesApplication",
  description: SiteConfig.description,
  url: SiteConfig.prodUrl,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function Home() {
  return (
    <main className="bg-background min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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
