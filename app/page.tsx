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
  },
  {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to get automatic YouTube video summaries with BriefTube",
    description:
      "Set up BriefTube in three steps and receive AI audio summaries of every new video from your YouTube channels, delivered to Telegram, Discord, Slack, or a podcast app.",
    step: [
      {
        "@type": "HowToStep",
        position: 1,
        name: "Add your channels",
        text: "Sign in with Google, then paste a YouTube channel URL into the dashboard. No RSS setup, no API keys required.",
        url: `${SiteConfig.prodUrl}/login`,
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: "Connect a delivery destination",
        text: "Link your Telegram account, Discord server, Slack workspace, or use the built-in private podcast RSS feed. Takes under a minute.",
        url: `${SiteConfig.prodUrl}/login`,
      },
      {
        "@type": "HowToStep",
        position: 3,
        name: "Receive summaries automatically",
        text: "BriefTube monitors your channels around the clock. When a new video is published, it extracts the transcript, generates an AI summary with Google Gemini, converts it to audio, and delivers it within minutes. No manual steps.",
      },
    ],
    tool: [
      {
        "@type": "HowToTool",
        name: "BriefTube account",
      },
    ],
    totalTime: "PT5M",
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
    sameAs: ["https://t.me/brief_tube_bot", "https://x.com/brieftube"],
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is the best app to automatically summarize YouTube videos?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "BriefTube is the best option for automatic YouTube summarization. It monitors channels you follow around the clock, generates an AI summary the moment a new video is published, and delivers it as audio to Telegram, Discord, Slack, or a podcast feed. No manual action required after the initial setup. On-demand tools like Eightify or Kagi Summarizer require you to initiate summarization yourself for each video.",
        },
      },
      {
        "@type": "Question",
        name: "How does BriefTube actually work?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Each channel you follow gets checked automatically through YouTube's RSS feed. The moment a new video appears, BriefTube reads its transcript, generates a summary using Google Gemini, converts it to audio with neural text-to-speech, and delivers it to your Telegram, Discord, Slack, or podcast app. The whole process usually takes under 30 minutes. No manual steps on your end after the first setup.",
        },
      },
      {
        "@type": "Question",
        name: "Is there a free YouTube summarizer that works automatically?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. BriefTube's free plan monitors up to 5 YouTube channels automatically at no cost, with no credit card required. It generates AI audio summaries for every new video and delivers them to Telegram, Discord, Slack, or a private podcast feed.",
        },
      },
      {
        "@type": "Question",
        name: "How quickly does BriefTube process a new YouTube video?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Typically within 15 to 30 minutes of the video being published. BriefTube checks channel RSS feeds every 5 minutes and processing usually completes in under 20 minutes. Pro users get priority processing which can be faster.",
        },
      },
      {
        "@type": "Question",
        name: "Which languages work?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "55 languages are supported, including English, French, Spanish, German, Japanese, and Arabic. BriefTube detects the video language automatically and generates the summary in the same language. Pro users can pick a specific voice from several options per language, or choose a different output language.",
        },
      },
      {
        "@type": "Question",
        name: "Can I use BriefTube with a podcast app like Overcast or Apple Podcasts?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Every BriefTube account includes a personal private RSS podcast feed URL. Add it to any podcast app and your summaries appear as episodes. It works with Overcast, Pocket Casts, Apple Podcasts, Castro, Podcast Addict, and any other RSS-compatible podcast player.",
        },
      },
      {
        "@type": "Question",
        name: "What AI does BriefTube use?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "BriefTube uses Google Gemini to generate summaries from video transcripts. Audio is synthesized using Microsoft Edge Neural TTS, which provides natural-sounding voices in 55 languages. The transcripts are sourced directly from YouTube's API when available.",
        },
      },
      {
        "@type": "Question",
        name: "Can teams use BriefTube to monitor YouTube channels?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Connect BriefTube to a shared Discord server channel or Slack workspace, and summaries are delivered to the whole team. This works well for competitive intelligence, industry monitoring, and shared learning. The Pro plan removes channel limits so teams can follow as many channels as needed.",
        },
      },
      {
        "@type": "Question",
        name: "Do I need to set up a Telegram bot?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No setup required. For Telegram, you click a connect link, it opens @brief_tube_bot, you send /start and you're done. For Discord or Slack, you authorize the integration in a few clicks. Either way, it takes under a minute.",
        },
      },
      {
        "@type": "Question",
        name: "What happens if I cancel?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "You drop back to the free plan. Your channels stay, your history stays, you just lose access to the Pro features. No cancellation fees, no awkward retention flows.",
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
