import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { Suspense } from "react";
import { unstable_cache } from "next/cache";
import { Hero } from "@/components/landing/hero";
import { Navbar } from "@/components/landing/navbar";
import { SocialProof } from "@/components/landing/social-proof";
import { SiteConfig } from "@/site-config";
import { getStripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import type { PricesData } from "@/hooks/use-prices";

const getCachedPrices = unstable_cache(
  async () => fetchPrices(),
  ["landing-prices"],
  { revalidate: 300 },
);

const getCachedStats = unstable_cache(
  async () => fetchStats(),
  ["landing-stats"],
  { revalidate: 300 },
);

const Problem = dynamic(async () =>
  import("@/components/landing/problem").then((m) => ({ default: m.Problem })),
);
const HowItWorks = dynamic(async () =>
  import("@/components/landing/how-it-works").then((m) => ({
    default: m.HowItWorks,
  })),
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
const Footer = dynamic(async () =>
  import("@/components/landing/footer").then((m) => ({ default: m.Footer })),
);

export const metadata: Metadata = {
  title: {
    absolute:
      "BriefTube: YouTube Summaries On Your Terms | Text or audio, delivered where you want",
  },
  description: `BriefTube turns your YouTube channels into a clean inbox. Browse new videos, pick what's worth your time, and get text or audio summaries delivered to Telegram, a private podcast feed, or your dashboard. Free for ${SiteConfig.freeChannelsLimit} channels.`,
  alternates: {
    canonical: SiteConfig.prodUrl,
  },
  openGraph: {
    title:
      "BriefTube: YouTube Summaries On Your Terms | Text or audio, delivered where you want",
    description: `See every new video from your YouTube channels in one inbox. Summarize the ones worth your time, skip the rest. Text or audio, your call. Free for ${SiteConfig.freeChannelsLimit} channels.`,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "BriefTube: YouTube summaries, text or audio, delivered where you want",
      },
    ],
  },
  twitter: {
    title:
      "BriefTube: YouTube Summaries On Your Terms | Text or audio, delivered where you want",
    description: `See every new video from your YouTube channels in one inbox. Summarize the ones worth your time, skip the rest. Text or audio, your call. Free for ${SiteConfig.freeChannelsLimit} channels.`,
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
      `Monitor up to ${SiteConfig.freeChannelsLimit} channels for free`,
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
        price: "5",
        priceCurrency: "USD",
        name: "Plus",
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
    "@id": `${SiteConfig.prodUrl}/#organization`,
    name: SiteConfig.title,
    url: SiteConfig.prodUrl,
    logo: {
      "@type": "ImageObject",
      url: `${SiteConfig.prodUrl}/logo-hd.png`,
      width: 512,
      height: 512,
    },
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
          text: `Yes. BriefTube's free plan monitors up to ${SiteConfig.freeChannelsLimit} YouTube channels automatically at no cost, with no credit card required. It generates AI audio summaries for every new video and delivers them to Telegram, Discord, Slack, or a private podcast feed.`,
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
        name: "Where do the transcripts come from?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "BriefTube uses the word-for-word transcript of the video, pulled directly from YouTube. If no transcript is available (rare), Whisper transcribes the audio. The summary is always built exclusively from what was said in the video, nothing is added or invented.",
        },
      },
    ],
  },
];

function formatCount(n: number): string {
  if (n >= 10000) return `${Math.floor(n / 1000)}k+`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k+`;
  if (n >= 100) return `${Math.floor(n / 10) * 10}+`;
  return `${n}+`;
}

async function fetchStats(): Promise<{ value: string; label: string }[]> {
  try {
    const supabase = createAdminClient();

    const [{ count: summaryCount }, { count: channelCount }] =
      await Promise.all([
        supabase
          .from("processed_videos")
          .select("*", { count: "exact", head: true })
          .eq("status", "completed"),
        supabase
          .from("subscriptions")
          .select("*", { count: "exact", head: true })
          .eq("active", true),
      ]);

    const summaries = summaryCount ?? 0;
    const channels = channelCount ?? 0;

    return [
      summaries >= 20
        ? { value: formatCount(summaries), label: "summaries delivered" }
        : null,
      channels >= 10
        ? { value: formatCount(channels), label: "channels tracked" }
        : null,
    ].filter((s): s is { value: string; label: string } => s !== null);
  } catch {
    return [];
  }
}

async function fetchPrices(): Promise<PricesData | null> {
  try {
    const stripe = getStripe();
    const [proMonthly, proAnnual, plusMonthly, plusAnnual] = await Promise.all([
      stripe.prices.retrieve(env.STRIPE_PRO_PRICE_ID),
      stripe.prices.retrieve(env.STRIPE_PRO_ANNUAL_PRICE_ID),
      env.STRIPE_PLUS_PRICE_ID
        ? stripe.prices.retrieve(env.STRIPE_PLUS_PRICE_ID)
        : null,
      env.STRIPE_PLUS_ANNUAL_PRICE_ID
        ? stripe.prices.retrieve(env.STRIPE_PLUS_ANNUAL_PRICE_ID)
        : null,
    ]);
    return {
      monthly: {
        amount: proMonthly.unit_amount ?? 0,
        currency: proMonthly.currency,
      },
      annual: {
        amount: proAnnual.unit_amount ?? 0,
        currency: proAnnual.currency,
      },
      plus: plusMonthly
        ? {
            monthly: {
              amount: plusMonthly.unit_amount ?? 0,
              currency: plusMonthly.currency,
            },
            annual: plusAnnual
              ? {
                  amount: plusAnnual.unit_amount ?? 0,
                  currency: plusAnnual.currency,
                }
              : null,
          }
        : null,
      pro: {
        monthly: {
          amount: proMonthly.unit_amount ?? 0,
          currency: proMonthly.currency,
        },
        annual: {
          amount: proAnnual.unit_amount ?? 0,
          currency: proAnnual.currency,
        },
      },
    };
  } catch {
    return null;
  }
}

export default async function Home() {
  const [prices, stats] = await Promise.all([
    getCachedPrices(),
    getCachedStats(),
  ]);
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
      <Suspense fallback={<div className="h-[110px]" />}>
        <SocialProof stats={stats} />
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
        <Features />
      </Suspense>
      <Suspense fallback={<div className="h-64" />}>
        <Pricing prices={prices} />
      </Suspense>
      <div className="section-divider" />
      <Suspense fallback={<div className="h-64" />}>
        <FAQ />
      </Suspense>
      {/* FinalCTA removed: hero URL input is the primary CTA now */}
      <Suspense fallback={<div className="h-32" />}>
        <Footer />
      </Suspense>
    </main>
  );
}
