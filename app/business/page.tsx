import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { Navbar } from "@/components/landing/navbar";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { SiteConfig } from "@/site-config";
import { BusinessWaitlistForm } from "@/components/landing/business-waitlist-form";

const Footer = dynamic(async () =>
  import("@/components/landing/footer").then((m) => ({ default: m.Footer })),
);

export const metadata: Metadata = {
  title: "BriefTube Teams — Audio briefings on every competitor video",
  description:
    "Monitor every YouTube channel your competitors and industry leaders publish on. Get an 8-minute audio brief every Monday morning. Join the limited beta.",
  alternates: {
    canonical: `${SiteConfig.prodUrl}/business`,
  },
  openGraph: {
    title: "BriefTube Teams — Audio briefings on every competitor video",
    description:
      "Monitor every YouTube channel your competitors and industry leaders publish on. Get an 8-minute audio brief every Monday.",
    url: `${SiteConfig.prodUrl}/business`,
  },
};

const painCards = [
  {
    quote:
      "Your competitor published a product demo three weeks ago. Your team had no idea — until a customer mentioned it in a sales call.",
    cite: "PageCrawl, on YouTube competitive blind spots",
  },
  {
    quote:
      "Google Alerts gives me every bit of news. I'd just like to know about the major milestones — release, delays, reviews.",
    cite: "yunusabd, Hacker News",
  },
  {
    quote:
      "Manual triage means 30 minutes every morning sorting signal from noise. When 90% of alerts are irrelevant, you start ignoring them all.",
    cite: "Foundation Inc, on B2B intelligence overload",
  },
];

const steps = [
  {
    n: "1",
    title: "Send us 5–20 channels",
    body: "Competitors. Industry leaders. Podcasts. Conference channels. Whatever you want on your radar.",
  },
  {
    n: "2",
    title: "We watch them all, every day",
    body: "Every new video gets transcribed, summarized, and scored for relevance to your team. No filler, no fluff.",
  },
  {
    n: "3",
    title: "8-minute audio brief, Monday morning",
    body: "Listen on your commute. Get the week's highlights as a private podcast feed, in Slack, or by email.",
  },
];

const features = [
  {
    title: "Audio first",
    body: "Built for commutes and gym sessions. Listen at 1.5×. Cover a week of YouTube in 8 minutes.",
  },
  {
    title: "Signal, not noise",
    body: "We cut filler, listicles, and reposts. Only the videos worth your team's attention.",
  },
  {
    title: "Slack-native",
    body: "Briefs land in your team channel. Threaded discussion built-in. Or pick email or RSS podcast feed.",
  },
  {
    title: "Keyword alerts",
    body: "Instant Slack ping the moment a competitor mentions your product, a feature you ship, or a topic you track.",
  },
];

const faqs = [
  {
    q: "How is this different from Octolens, Crayon or Klue?",
    a: "Most competitive intelligence tools are dashboards focused on websites and social. BriefTube Teams is YouTube-first, audio-first. We summarize what was actually said in the video, not what was scraped from a metadata description. Weekly audio brief, not yet another dashboard to check.",
  },
  {
    q: "Why audio and not just text?",
    a: "Reading a competitive intel digest is a chore that gets deprioritized. Listening to one on your commute or workout doesn't compete with anything. Teams that listen actually consume the brief — teams that read don't.",
  },
  {
    q: "What does it cost?",
    a: "$99/month per team during the beta — flat, up to 20 channels, weekly brief, Slack delivery. No card required to join the waitlist. We send the first brief manually before any billing.",
  },
  {
    q: "What happens after I join the waitlist?",
    a: "We reach out within a few days. You give us your channels, we deliver your first audio brief by hand within a week. If it's worth your time, we set up automation and start the subscription. If not, you walk.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "BriefTube Teams",
  description:
    "B2B competitive intelligence audio briefings sourced from YouTube channels you choose to monitor.",
  brand: { "@type": "Brand", name: "BriefTube" },
  url: `${SiteConfig.prodUrl}/business`,
  offers: {
    "@type": "Offer",
    price: "99",
    priceCurrency: "USD",
    availability: "https://schema.org/PreOrder",
    url: `${SiteConfig.prodUrl}/business`,
  },
};

export default function BusinessPage() {
  return (
    <main className="bg-background min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden pt-28 pb-12 md:pt-44 md:pb-20">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-red-600/15 blur-[60px] md:blur-[80px]" />
          <div className="absolute top-1/3 right-0 hidden h-[400px] w-[400px] rounded-full bg-blue-500/12 blur-[60px] md:block" />
        </div>

        <div className="mx-auto max-w-4xl px-5 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            <span className="text-muted-foreground">
              BriefTube Teams — limited beta
            </span>
          </div>

          <h1 className="font-display text-3xl leading-[1.1] font-bold tracking-tight md:text-6xl">
            Your competitors are publishing videos.{" "}
            <span className="bg-gradient-to-r from-red-500 to-orange-400 bg-clip-text text-transparent">
              You haven&apos;t watched any of them.
            </span>
          </h1>

          <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-base md:text-xl">
            BriefTube Teams turns 20 YouTube channels into an 8-minute audio
            brief every Monday morning. Listen on your commute. Skip 4 hours of
            video.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3">
            <a
              href="#waitlist"
              className="inline-flex h-12 items-center justify-center rounded-lg bg-red-600 px-8 text-base font-medium text-white shadow-[0_0_30px_rgba(239,68,68,0.3)] transition-all hover:bg-red-500 hover:shadow-[0_0_40px_rgba(239,68,68,0.4)]"
            >
              Join the waitlist
            </a>
            <p className="text-muted-foreground text-xs">
              First brief delivered manually. No card required.
            </p>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* Pain — verbatims */}
      <section className="py-12 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <ScrollReveal>
            <h2 className="font-display text-center text-2xl font-bold md:text-3xl">
              The problem is not lack of information.
              <br />
              <span className="text-muted-foreground">
                It&apos;s lack of time to consume it.
              </span>
            </h2>
          </ScrollReveal>

          <ScrollReveal delay={150}>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {painCards.map((card) => (
                <figure
                  key={card.cite}
                  className="rounded-2xl border border-white/[0.08] border-t-white/[0.15] bg-white/[0.04] p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-xl"
                >
                  <blockquote className="text-foreground text-sm leading-relaxed">
                    &ldquo;{card.quote}&rdquo;
                  </blockquote>
                  <figcaption className="text-muted-foreground mt-4 text-xs">
                    — {card.cite}
                  </figcaption>
                </figure>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* How it works */}
      <section className="py-14 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <ScrollReveal>
            <h2 className="font-display text-center text-2xl font-bold md:text-3xl">
              How it works
            </h2>
          </ScrollReveal>

          <ScrollReveal delay={150}>
            <div className="mt-12 grid gap-12 md:mt-16 md:grid-cols-3">
              {steps.map((step) => (
                <div key={step.n} className="text-center">
                  <div className="nm-raised mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold text-red-400">
                    {step.n}
                  </div>
                  <h3 className="mb-3 text-lg font-semibold">{step.title}</h3>
                  <p className="text-muted-foreground text-sm">{step.body}</p>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      <div className="section-divider" />

      {/* Features */}
      <section className="py-14 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <ScrollReveal>
            <h2 className="font-display text-center text-2xl font-bold md:text-3xl">
              Built for teams that don&apos;t have time to watch
            </h2>
          </ScrollReveal>

          <ScrollReveal delay={150}>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl border border-white/[0.08] border-t-white/[0.15] bg-white/[0.04] p-6 backdrop-blur-xl"
                >
                  <h3 className="text-base font-semibold">{f.title}</h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {f.body}
                  </p>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Pricing + Waitlist */}
      <section
        id="waitlist"
        className="scroll-mt-24 py-14 md:py-24"
        aria-labelledby="waitlist-title"
      >
        <div className="mx-auto max-w-2xl px-6">
          <ScrollReveal>
            <div className="text-center">
              <h2
                id="waitlist-title"
                className="font-display text-2xl font-bold md:text-3xl"
              >
                Join the limited beta
              </h2>
              <p className="text-muted-foreground mt-3 text-sm">
                $99/month, flat. Up to 20 channels. Cancel any time. We deliver
                your first brief manually before any billing.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={150}>
            <div className="mt-8 rounded-2xl border border-white/[0.08] border-t-white/[0.15] bg-white/[0.04] p-6 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl md:p-8">
              <BusinessWaitlistForm />
            </div>
          </ScrollReveal>
        </div>
      </section>

      <div className="section-divider" />

      {/* FAQ */}
      <section className="py-14 md:py-20">
        <div className="mx-auto max-w-3xl px-6">
          <ScrollReveal>
            <h2 className="font-display text-center text-2xl font-bold md:text-3xl">
              Frequently asked
            </h2>
          </ScrollReveal>

          <ScrollReveal delay={150}>
            <div className="mt-10 flex flex-col gap-4">
              {faqs.map((item) => (
                <details
                  key={item.q}
                  className="group rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5 backdrop-blur-xl"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium">
                    {item.q}
                    <span className="text-muted-foreground transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      <Footer />
    </main>
  );
}
