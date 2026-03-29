import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { Button } from "@/components/ui/button";
import { SiteConfig } from "@/site-config";

export const metadata: Metadata = {
  title: "YouTube Summary App — AI-Powered, Automatic | BriefTube",
  description: `Get an AI-generated YouTube summary for every new video from the channels you follow. BriefTube creates automatic audio summaries and delivers them to Telegram, Discord, Slack, or your podcast app. Free for ${SiteConfig.freeChannelsLimit} channels.`,
  alternates: {
    canonical: `${SiteConfig.prodUrl}/youtube-summary`,
  },
  openGraph: {
    title: "YouTube Summary App — AI-Powered, Automatic | BriefTube",
    description:
      "Get an AI-generated YouTube summary for every new video from the channels you follow. Automatic, instant, delivered wherever you listen.",
    url: `${SiteConfig.prodUrl}/youtube-summary`,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "BriefTube — YouTube Summary App",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "YouTube Summary App — AI-Powered, Automatic | BriefTube",
    description:
      "Get an AI-generated YouTube summary for every new video from the channels you follow.",
  },
};

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "YouTube Summary App — BriefTube",
    url: `${SiteConfig.prodUrl}/youtube-summary`,
    description:
      "AI-powered automatic YouTube summary tool. BriefTube monitors your YouTube channels and delivers a short audio summary for every new video.",
    isPartOf: {
      "@type": "WebSite",
      name: "BriefTube",
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
        name: "YouTube Summary",
        item: `${SiteConfig.prodUrl}/youtube-summary`,
      },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "BriefTube",
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web Browser",
    description:
      "BriefTube is an automatic YouTube summary app. It monitors YouTube channels, generates AI summaries of every new video, converts them to audio, and delivers them to Telegram, Discord, Slack, or a private podcast feed.",
    url: SiteConfig.prodUrl,
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
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is a YouTube summary?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "A YouTube summary is a condensed version of a YouTube video's content — the key points, insights, and conclusions extracted from the transcript. A good YouTube summary lets you understand what a video covers in 3–5 minutes instead of watching the full video, which can be 30 minutes to 2 hours long.",
        },
      },
      {
        "@type": "Question",
        name: "How do I get an automatic YouTube summary?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "BriefTube automatically generates a YouTube summary for every new video from the channels you follow. You add channels to your BriefTube dashboard once, and from that point on, every new upload gets summarized automatically — no manual triggering needed. The summary is delivered as audio to Telegram, Discord, Slack, or your podcast app within 30 minutes of the video going live.",
        },
      },
      {
        "@type": "Question",
        name: "What is the best YouTube summary app?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "BriefTube is the best YouTube summary app for people who follow multiple channels and want fully automatic summaries. Unlike manual tools like Eightify or Kagi Summarizer that require you to paste a URL each time, BriefTube monitors your channels around the clock and delivers summaries automatically. It also converts summaries to audio so you can listen hands-free.",
        },
      },
      {
        "@type": "Question",
        name: "Can I get YouTube summaries for free?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `Yes. BriefTube's free plan monitors up to ${SiteConfig.freeChannelsLimit} YouTube channels at no cost, with no credit card required. You get automatic AI audio summaries for every new video from those ${SiteConfig.freeChannelsLimit} channels, delivered to Telegram, Discord, Slack, or a private podcast feed.`,
        },
      },
      {
        "@type": "Question",
        name: "Can YouTube summaries be in audio format?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. BriefTube converts every YouTube summary into a natural-sounding audio file using Microsoft's neural text-to-speech. This lets you listen to YouTube summaries hands-free while commuting, exercising, or cooking. Audio summaries are available in 55 languages.",
        },
      },
      {
        "@type": "Question",
        name: "How long is a YouTube summary?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "A BriefTube YouTube summary is typically 3 to 6 minutes of audio, regardless of how long the original video is. A 2-hour podcast episode becomes a 5-minute summary. A 15-minute explainer video becomes a 3-minute summary. The goal is to give you all the key insights in the shortest possible time.",
        },
      },
      {
        "@type": "Question",
        name: "Does YouTube have its own summary feature?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "YouTube has rolled out an experimental AI summary feature in some regions, but it only works on a limited subset of videos and is not available as audio. BriefTube works on any YouTube channel, any language, converts summaries to audio, and delivers them automatically to your preferred messaging app or podcast player.",
        },
      },
      {
        "@type": "Question",
        name: "How accurate are AI YouTube summaries?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "BriefTube's summaries are built directly from the video's official transcript, not from the video title or thumbnail. This means the summary only reflects what was actually said. Google Gemini is used to extract and condense the key points. Accuracy depends on transcript quality — if the transcript is clear and complete, the summary will be reliable.",
        },
      },
    ],
  },
];

const steps = [
  {
    number: "01",
    title: "Add channels",
    description: `Search for any YouTube channel by name or URL and add it to your BriefTube dashboard. The free plan includes ${SiteConfig.freeChannelsLimit} channels.`,
  },
  {
    number: "02",
    title: "BriefTube monitors 24/7",
    description:
      "Every channel is checked via YouTube's RSS feed every 5 minutes. The moment a new video is published, the process starts automatically.",
  },
  {
    number: "03",
    title: "AI generates the summary",
    description:
      "The video transcript is extracted and fed to Google Gemini, which produces a concise summary capturing the key insights.",
  },
  {
    number: "04",
    title: "Summary converted to audio",
    description:
      "Microsoft's neural text-to-speech converts the summary to natural-sounding audio in the video's original language — or any language you choose.",
  },
  {
    number: "05",
    title: "Delivered to you",
    description:
      "The audio summary lands in your Telegram, Discord, Slack, or private podcast feed. Typically within 30 minutes of the video going live.",
  },
];

const comparisons = [
  {
    label: "BriefTube",
    automatic: true,
    audio: true,
    multiChannel: true,
    delivery: true,
    free: true,
    highlight: true,
  },
  {
    label: "Eightify",
    automatic: false,
    audio: false,
    multiChannel: false,
    delivery: false,
    free: false,
    highlight: false,
  },
  {
    label: "Kagi Summarizer",
    automatic: false,
    audio: false,
    multiChannel: false,
    delivery: false,
    free: false,
    highlight: false,
  },
  {
    label: "Glasp",
    automatic: false,
    audio: false,
    multiChannel: false,
    delivery: false,
    free: true,
    highlight: false,
  },
];

const faqs = [
  {
    q: "What is a YouTube summary?",
    a: "A YouTube summary is a condensed version of a video's content — the key points, insights, and conclusions distilled from the transcript. A good summary lets you understand what a video covers in 3–5 minutes instead of watching the full video.",
  },
  {
    q: "How do I get an automatic YouTube summary?",
    a: "Add channels to your BriefTube dashboard once. Every new video from those channels gets summarized automatically and delivered as audio to Telegram, Discord, Slack, or your podcast app — no manual action required.",
  },
  {
    q: "What is the best YouTube summary app?",
    a: "BriefTube is the best option for people who follow multiple channels and want fully automatic summaries. Manual tools like Eightify require you to paste a URL each time. BriefTube runs 24/7 and delivers audio summaries hands-free.",
  },
  {
    q: "Is there a free YouTube summary tool?",
    a: `Yes. BriefTube's free plan monitors up to ${SiteConfig.freeChannelsLimit} YouTube channels automatically at no cost. No credit card required.`,
  },
  {
    q: "How long does a YouTube summary take?",
    a: "BriefTube typically completes the full process — detect, transcribe, summarize, convert to audio, deliver — within 15 to 30 minutes of the video going live.",
  },
  {
    q: "Does YouTube have a built-in summary feature?",
    a: "YouTube has an experimental AI summary feature in some regions, but it covers a limited set of videos and isn't available as audio. BriefTube works on any channel, converts summaries to audio, and delivers them automatically.",
  },
  {
    q: "How long is a typical YouTube summary?",
    a: "3 to 6 minutes of audio, regardless of the original video length. A 2-hour podcast episode becomes a 5-minute summary. A 15-minute explainer video becomes a 3-minute summary.",
  },
  {
    q: "Are YouTube summaries accurate?",
    a: "BriefTube builds summaries from the official video transcript — only what was actually said. Google Gemini extracts the key points. Accuracy depends on transcript quality, which is typically high for well-produced videos.",
  },
];

export default function YouTubeSummaryPage() {
  return (
    <div className="bg-background min-h-screen">
      {jsonLd.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}

      <Navbar />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden pt-28 pb-16 md:pt-40 md:pb-24">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute top-0 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-red-600/12 blur-[80px]" />
          </div>
          <div className="mx-auto max-w-3xl px-6 text-center">
            <div className="mb-4 inline-flex items-center rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400">
              AI-Powered
            </div>
            <h1 className="font-display text-4xl leading-tight font-bold tracking-tight md:text-6xl">
              YouTube Summary
            </h1>
            <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg md:text-xl">
              Get an AI-generated audio summary of every new video from the
              channels you follow. Automatic. Delivered to Telegram, Discord,
              Slack, or your podcast app within 30 minutes.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Button
                size="lg"
                className="h-12 bg-red-600 px-8 text-base shadow-[0_0_30px_rgba(239,68,68,0.3)] hover:bg-red-500"
                asChild
              >
                <Link href="/login">Get YouTube Summaries Free</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-8 text-base"
                asChild
              >
                <Link href="/pricing">View Pricing</Link>
              </Button>
            </div>
            <p className="text-muted-foreground mt-4 text-sm">
              {`Free for ${SiteConfig.freeChannelsLimit} channels — no credit card required`}
            </p>
          </div>
        </section>

        {/* What is a YouTube summary */}
        <section className="mx-auto max-w-4xl px-6 py-16 md:py-24">
          <div className="grid gap-12 md:grid-cols-2 md:items-center">
            <div className="flex flex-col gap-6">
              <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
                What is a YouTube summary?
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                A YouTube summary is a condensed version of a video&apos;s
                content — the key points, insights, and conclusions extracted
                from the transcript. Instead of watching a 90-minute video, you
                get the essence in 5 minutes.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Most people follow more YouTube channels than they can actually
                watch. The average YouTube subscriber has 40+ channel
                subscriptions but realistically follows 3. A YouTube summary
                solves that gap: you stay up to date on everything, without
                spending hours watching.
              </p>
            </div>
            <div className="nm-raised flex flex-col gap-5 rounded-2xl p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-2xl font-black text-zinc-600">
                  1h47
                </div>
                <div>
                  <p className="font-medium text-zinc-400">Original video</p>
                  <p className="text-muted-foreground text-sm">
                    107 minutes watched
                  </p>
                </div>
              </div>
              <div className="h-px bg-white/5" />
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-2xl font-black text-red-400">
                  5m
                </div>
                <div>
                  <p className="font-medium text-white">YouTube summary</p>
                  <p className="text-muted-foreground text-sm">
                    Audio, hands-free, automatic
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-4xl border-t border-white/5 px-6" />

        {/* How it works */}
        <section className="mx-auto max-w-4xl px-6 py-16 md:py-24">
          <div className="mb-12 flex flex-col gap-4">
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              How BriefTube creates YouTube summaries
            </h2>
            <p className="text-muted-foreground max-w-2xl leading-relaxed">
              Set it up once in under 5 minutes. After that, every new video
              from your channels gets summarized automatically.
            </p>
          </div>
          <div className="flex flex-col gap-6">
            {steps.map((step) => (
              <div key={step.number} className="flex gap-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-sm font-black text-red-400">
                  {step.number}
                </div>
                <div className="flex flex-col gap-1 pt-1">
                  <p className="font-semibold text-white">{step.title}</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="mx-auto max-w-4xl border-t border-white/5 px-6" />

        {/* Audio summaries */}
        <section className="mx-auto max-w-4xl px-6 py-16 md:py-24">
          <div className="grid gap-12 md:grid-cols-2 md:items-start">
            <div className="flex flex-col gap-6">
              <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
                YouTube summaries as audio
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Reading a YouTube summary is fine. Listening to it while
                commuting, exercising, or cooking is better. BriefTube converts
                every summary to natural-sounding audio using Microsoft&apos;s
                neural text-to-speech.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                A 90-minute Lex Fridman episode becomes a 5-minute audio summary
                in your Telegram. A 20-minute Fireship video becomes a 3-minute
                listen on your morning run. Your brain learns while you live.
              </p>
              <ul className="flex flex-col gap-3">
                {[
                  "55 languages supported",
                  "Natural-sounding neural voices",
                  "Works in any podcast app via RSS",
                  "Delivered as voice messages to Telegram",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-4">
              {[
                { label: "While commuting", time: "5 summaries per hour" },
                { label: "While cooking", time: "2 summaries in 20 min" },
                { label: "While running", time: "1 summary per km" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="nm-raised flex items-center justify-between rounded-xl px-5 py-4"
                >
                  <span className="font-medium text-white">{item.label}</span>
                  <span className="text-muted-foreground text-sm">
                    {item.time}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-4xl border-t border-white/5 px-6" />

        {/* Comparison table */}
        <section className="mx-auto max-w-4xl px-6 py-16 md:py-24">
          <div className="mb-10 flex flex-col gap-4">
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              Automatic vs manual YouTube summary tools
            </h2>
            <p className="text-muted-foreground max-w-2xl leading-relaxed">
              Most YouTube summary tools require you to manually paste a video
              URL every time. BriefTube is the only option that works
              automatically for all your channels.
            </p>
          </div>
          <div className="nm-raised overflow-hidden rounded-2xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-4 py-3 text-left font-medium text-zinc-400">
                    Tool
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-zinc-400">
                    Automatic
                  </th>
                  <th className="hidden px-4 py-3 text-center font-medium text-zinc-400 sm:table-cell">
                    Audio
                  </th>
                  <th className="hidden px-4 py-3 text-center font-medium text-zinc-400 md:table-cell">
                    Multi-channel
                  </th>
                  <th className="hidden px-4 py-3 text-center font-medium text-zinc-400 lg:table-cell">
                    Delivery
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-zinc-400">
                    Free plan
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map((row) => (
                  <tr
                    key={row.label}
                    className={`border-b border-white/5 last:border-0 ${row.highlight ? "bg-red-500/5" : ""}`}
                  >
                    <td className="px-4 py-3 font-medium text-white">
                      {row.label}
                      {row.highlight && (
                        <span className="ml-2 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
                          Best
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.automatic ? (
                        <span className="text-green-400">✓</span>
                      ) : (
                        <span className="text-zinc-600">✗</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-center sm:table-cell">
                      {row.audio ? (
                        <span className="text-green-400">✓</span>
                      ) : (
                        <span className="text-zinc-600">✗</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-center md:table-cell">
                      {row.multiChannel ? (
                        <span className="text-green-400">✓</span>
                      ) : (
                        <span className="text-zinc-600">✗</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-center lg:table-cell">
                      {row.delivery ? (
                        <span className="text-green-400">✓</span>
                      ) : (
                        <span className="text-zinc-600">✗</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.free ? (
                        <span className="text-green-400">✓</span>
                      ) : (
                        <span className="text-zinc-600">✗</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground mt-4 text-xs">
            Full comparisons:{" "}
            <Link
              href="/vs/eightify"
              className="text-red-400 hover:text-red-300"
            >
              BriefTube vs Eightify
            </Link>
            {" · "}
            <Link href="/vs/kagi" className="text-red-400 hover:text-red-300">
              BriefTube vs Kagi
            </Link>
            {" · "}
            <Link href="/vs/glasp" className="text-red-400 hover:text-red-300">
              BriefTube vs Glasp
            </Link>
          </p>
        </section>

        <div className="mx-auto max-w-4xl border-t border-white/5 px-6" />

        {/* FAQ */}
        <section className="mx-auto max-w-4xl px-6 py-16 md:py-24">
          <h2 className="font-display mb-10 text-3xl font-bold tracking-tight md:text-4xl">
            YouTube summary — FAQ
          </h2>
          <div className="flex flex-col gap-6">
            {faqs.map((faq) => (
              <div key={faq.q} className="flex flex-col gap-2">
                <h3 className="font-semibold text-white">{faq.q}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="mx-auto max-w-4xl border-t border-white/5 px-6" />

        {/* CTA */}
        <section className="mx-auto max-w-4xl px-6 py-16 md:py-24">
          <div className="nm-raised flex flex-col items-center gap-6 rounded-2xl border border-red-500/[0.12] p-8 text-center md:p-12">
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              Start getting YouTube summaries today
            </h2>
            <p className="text-muted-foreground max-w-lg leading-relaxed">
              {`Add up to ${SiteConfig.freeChannelsLimit} YouTube channels for free. Every new video gets summarized automatically and delivered as audio to wherever you listen.`}
            </p>
            <Button
              size="lg"
              className="h-12 bg-red-600 px-10 text-base shadow-[0_0_30px_rgba(239,68,68,0.3)] hover:bg-red-500"
              asChild
            >
              <Link href="/login">Get Started Free</Link>
            </Button>
            <p className="text-muted-foreground text-sm">
              {`Free for ${SiteConfig.freeChannelsLimit} channels · `}
              <Link href="/pricing" className="underline underline-offset-2">
                See all plans
              </Link>
            </p>
          </div>
        </section>

        {/* Related links */}
        <section className="mx-auto max-w-4xl px-6 pb-16">
          <div className="flex flex-wrap gap-3">
            <Link
              href="/blog"
              className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-2 transition-colors"
            >
              Blog
            </Link>
            <span className="text-zinc-700">·</span>
            <Link
              href="/vs"
              className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-2 transition-colors"
            >
              Compare YouTube summary tools
            </Link>
            <span className="text-zinc-700">·</span>
            <Link
              href="/channels"
              className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-2 transition-colors"
            >
              Browse YouTube channel summaries
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
