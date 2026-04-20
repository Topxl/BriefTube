import { SiteConfig } from "@/site-config";

const FREE = SiteConfig.freeChannelsLimit;
const PLUS = SiteConfig.plusChannelsLimit;
const TRIAL = SiteConfig.trialDays;

export const landing = {
  nav: {
    howItWorks: "How it works",
    features: "Features",
    pricing: "Pricing",
    faq: "FAQ",
    star: "Star",
    logIn: "Log in",
    startFree: "Start Free",
    openMenu: "Open menu",
    menu: "Menu",
  },
  hero: {
    badge: `Free up to ${FREE} channels. No credit card needed.`,
    heading: "See what's new. Pick what matters.",
    headingHighlight: "Skip the rest.",
    subtitle:
      'Add your YouTube channels. New videos land in one inbox. Hit "Summarize" on the ones worth your time, then read it, listen to it, or get it as a podcast. No algorithm pushing what you should watch.',
    ctaPrimary: "Try it free",
    ctaPricing: "See pricing",
    ctaPricingMobile: "Or see pricing",
    ctaSecondary: "See a live example",
    socialProof: `No credit card · Cancel anytime · ${TRIAL}-day Pro trial`,
    postTrialNote: `After trial: ${FREE} channels free forever. No card, no catch.`,
    mockupBotRole: "bot",
    mockupVideo1Channel: "TED",
    mockupVideo1Title: "How Great Leaders Inspire Action",
    mockupVideo2Channel: "Huberman Lab",
    mockupVideo2Title: "Master Your Sleep",
  },
  problem: {
    heading: "You subscribe to 50+ channels.",
    headingMuted: "You can't watch them all.",
    items: [
      {
        title: "The backlog never shrinks",
        description:
          "New videos pile up faster than you can get to them. At some point you just stop trying.",
      },
      {
        title: "Watching takes your full attention",
        description:
          "On a commute, at the gym, cooking dinner. Your ears are free but a 40-minute video isn't happening.",
      },
      {
        title:
          "You can't tell what's worth watching until you've already watched it",
        description:
          "That one video with the insight you actually needed? You'll probably never find it in time.",
      },
    ],
  },
  howItWorks: {
    heading: "How it works",
    subtitle: "Three steps to set up. Stay in control.",
    stepPrefix: "Step",
    steps: [
      {
        title: "Add your YouTube channels",
        description:
          "Paste a channel URL, a handle like @MKBHD, or import your YouTube subscriptions in one click.",
      },
      {
        title: "See every new video in one clean inbox",
        description:
          "Instead of scrolling YouTube, browse the new uploads from the channels you follow in one feed. No recommendations, no rabbit holes.",
      },
      {
        title: "Summarize the ones worth it",
        description:
          'Click "Summarize" on any video you want. Get it as text, audio, or a private podcast feed. Prefer full auto? Switch it on per channel.',
      },
    ],
  },
  features: {
    heading: "What you actually get",
    subtitle: "Browse what's new. Pick what's worth reading or listening to.",
    items: [
      {
        title: "You decide what gets summarized",
        description:
          'Browse new videos from your channels in one feed. Click "Summarize" on the ones that look worth your time. No more auto-generated noise you\'ll never read.',
      },
      {
        title: "Summaries that go beyond the title",
        description:
          "The AI covers the main arguments, examples, and takeaways. Not just a rephrased headline.",
      },
      {
        title: "Read it or listen to it. Your call.",
        description:
          "Short text summaries for quick skimming, or neural TTS audio for when your hands are busy. Both available on every summary.",
      },
      {
        title: "Fast enough to be useful",
        description:
          "Most summaries arrive within a few minutes of a video going live. Sometimes faster.",
      },
      {
        title: "55 languages supported",
        description:
          "English, French, Spanish, German, Japanese, Arabic and 49 more. Pick the one that works for you. Pro users can also choose the specific voice.",
      },
      {
        title: "No channel limit on Pro",
        description:
          "Follow as many channels as you want. We don't arbitrarily cap it.",
      },
      {
        title: "Delivered your way",
        description:
          "Dashboard, private podcast RSS feed, Telegram, Discord, Slack. Pick what works for you. More delivery options are on the way.",
      },
    ],
  },
  demo: {
    label: "Try it now",
    heading: "Paste any YouTube URL",
    subtitle: "No account needed. We generate the summary in seconds.",
    placeholder: "https://youtube.com/watch?v=...",
    submit: "Summarize",
    error: "An error occurred.",
    upsellText:
      "Want this delivered automatically? As a podcast, on Discord, Slack, or Telegram.",
    upsellCta: `Create a free account. ${TRIAL}-day Pro trial included.`,
    hint: "3 free tries · Works on videos with subtitles",
  },
  pricing: {
    heading: "Straightforward pricing",
    subtitle:
      "Free to start, no card required. Upgrade if you hit the channel limit.",
    mostPopular: "Most Popular",
    perMonth: "month",
    plans: {
      free: {
        name: "Free",
        description: `${FREE} channels is enough to test whether this actually fits your workflow.`,
        features: [
          `${FREE} YouTube channels`,
          "AI audio summaries",
          "Dashboard + podcast RSS feed",
          "Telegram, Discord & Slack",
          "Standard processing",
        ],
        cta: "Start Free",
      },
      plus: {
        name: "Plus",
        description:
          "For creators and professionals who follow dozens of channels.",
        features: [
          `${PLUS} YouTube channels`,
          "AI audio summaries",
          "Dashboard + podcast RSS feed",
          "Telegram, Discord & Slack",
          "Priority processing",
        ],
        cta: "Go Plus",
      },
      pro: {
        name: "Pro",
        description:
          "For anyone who follows more channels than they'd like to admit.",
        features: [
          "Unlimited channels",
          "Priority processing",
          "Choose your TTS voice",
          "No branding",
          "Early access to new features",
        ],
        cta: "Go Pro",
      },
    },
  },
  faq: {
    heading: "Questions people actually ask",
    priceQuestionFn: (price: string) => `Wait, it's only ${price}/month?`,
    items: [
      {
        question: "Do I have to let it summarize everything automatically?",
        answer:
          "No. You can switch to manual mode, browse new videos from your channels in your BriefTube inbox, and pick which ones to summarize. Great if you follow big channels and only care about specific topics. Prefer full auto? Keep it on, or toggle it per channel.",
      },
      {
        // This question slot is overridden by priceQuestionFn in the component,
        // so this string is never shown. Keep a label for clarity in the data.
        question: "(price question — overridden in component)",
        answer:
          "Yeah, it is. We keep things lean: no big cloud infra, shared processing across users for the same video, free TTS. The goal was to build something I'd actually pay for myself, so the price had to make sense.",
      },
      {
        question: "How does it actually work?",
        answer:
          'When a channel you follow uploads, the video lands in your BriefTube inbox. You click "Summarize" on the ones worth your time, or enable auto mode to have them all summarized ahead of time. Summaries come as text and audio, and you can push them to Telegram, Discord, Slack, or a private podcast feed.',
      },
      {
        question: "Which languages work?",
        answer:
          "55 languages are supported, including English, French, Spanish, German, Japanese, and Arabic. BriefTube detects the language of the video and matches it automatically. Pro users can also pick a specific voice from several options per language.",
      },
      {
        question: "How do I receive my summaries?",
        answer:
          "However you prefer. They're always in your BriefTube dashboard. You can also subscribe to a private podcast RSS feed and listen in any podcast app, or connect Telegram, Discord, or Slack to get them pushed directly. All of it is optional, use what fits your workflow.",
      },
      {
        question: "Where do the transcripts come from?",
        answer:
          "BriefTube uses the word-for-word transcript of the video, pulled directly from YouTube. If no transcript is available (rare), Whisper transcribes the audio. The summary is always built exclusively from what was said in the video, nothing is added or invented.",
      },
    ],
  },
  finalCta: {
    heading: "Takes about 2 minutes to set up",
    subtitle: `Free for up to ${FREE} channels. No credit card, no commitment.`,
    ctaPrimary: "Start listening for free",
    loginText: "Already have an account?",
    loginLink: "Log in",
  },
  footer: {
    privacy: "Privacy",
    terms: "Terms",
    copyright: (year: number) => `© ${year} BriefTube. All rights reserved.`,
  },
};
