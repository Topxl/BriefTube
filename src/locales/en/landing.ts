import { SiteConfig } from "@/site-config";

const FREE = SiteConfig.freeChannelsLimit;

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
    heading: "Stay on top of your YouTube channels",
    headingHighlight: "without watching a single video",
    subtitle:
      "Add your channels, and BriefTube handles the rest. Every new upload gets summarized by AI and turned into a short audio file. Listen from the dashboard, subscribe as a private podcast, or get it pushed to Telegram, Discord, or Slack.",
    ctaPrimary: "Start listening for free",
    ctaSecondary: "See a live example",
    socialProof: "No credit card · Cancel anytime · 7-day Pro trial",
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
        title: "You miss things that matter",
        description:
          "That one video with the insight you actually needed? You'll probably never see it.",
      },
    ],
  },
  howItWorks: {
    heading: "How it works",
    subtitle: "Three steps to set up. Nothing to do after that.",
    stepPrefix: "Step",
    steps: [
      {
        title: "Add your channels",
        description:
          "Paste a YouTube channel URL into the dashboard. That's all. No RSS setup, no API keys.",
      },
      {
        title: "AI reads each new video",
        description:
          "When something new drops, BriefTube pulls the transcript and generates a summary. Takes under a minute for most videos.",
      },
      {
        title: "Get it wherever you are",
        description:
          "Your audio summary is ready within minutes. Listen from the dashboard, subscribe to your private podcast RSS feed, or get it pushed to Telegram, Discord, or Slack. More integrations coming.",
      },
    ],
  },
  features: {
    heading: "What you actually get",
    subtitle:
      "Set it up once. New summaries appear automatically, ready to play.",
    items: [
      {
        title: "Summaries that go beyond the title",
        description:
          "The AI covers the main arguments, examples, and takeaways. Not just a rephrased headline.",
      },
      {
        title: "Audio that doesn't sound like a robot",
        description:
          "We use Microsoft Edge's neural TTS voices. Not perfect, but genuinely listenable.",
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
    upsellCta: "Create a free account. 7-day Pro trial included.",
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
          "50 YouTube channels",
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
        question: "How does it actually work?",
        answer:
          "Each channel you follow gets checked automatically through YouTube's RSS feed. The moment a new video appears, BriefTube reads its transcript, generates a summary, and converts it to audio, usually within a few minutes. You can play it from your dashboard, or have it pushed to Telegram, Discord, Slack, or your podcast app. No manual steps on your end.",
      },
      {
        question: "",
        answer:
          "Yeah, it is. We keep things lean: no big cloud infra, shared processing across users for the same video, free TTS. The goal was to build something I'd actually pay for myself, so the price had to make sense.",
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
