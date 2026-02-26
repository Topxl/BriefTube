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
    badge: `Free up to ${FREE} channels — No credit card needed`,
    heading: "Stay on top of your YouTube channels",
    headingHighlight: "without watching a single video",
    subtitle:
      "Add your channels, connect your Telegram, and that's it. BriefTube tracks new uploads, summarizes them with AI, and sends you the audio — usually within a few minutes of the video going live.",
    ctaPrimary: "Get my summaries for free",
    ctaSecondary: "Try without signing up",
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
          "On a commute, at the gym, cooking dinner — your ears are free but a 40-minute video isn't happening.",
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
          "Paste a YouTube channel URL into the dashboard. That's all — no RSS setup, no API keys.",
      },
      {
        title: "AI reads each new video",
        description:
          "When something new drops, BriefTube pulls the transcript and generates a summary. Takes under a minute for most videos.",
      },
      {
        title: "You get a Telegram message",
        description:
          "An audio file lands in your chat, ready to play. Works while driving, walking, doing dishes.",
      },
    ],
  },
  features: {
    heading: "What you actually get",
    subtitle:
      "No dashboard to check. No notifications to manage. It just shows up.",
    items: [
      {
        title: "Summaries that go beyond the title",
        description:
          "The AI covers the main arguments, examples, and takeaways — not just a rephrased headline.",
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
          "English, French, Spanish, German, Japanese, Arabic and 49 more. Pick the one that works for you — Pro users can also choose the specific voice.",
      },
      {
        title: "No channel limit on Pro",
        description:
          "Follow as many channels as you want. We don't arbitrarily cap it.",
      },
      {
        title: "Telegram works offline",
        description:
          "Audio files download to your phone. No internet needed once they're in your chat.",
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
    upsellText: "Want to receive this automatically as audio on Telegram?",
    upsellCta: "Create a free account — 7-day Pro trial",
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
          "Telegram delivery",
          "Standard processing",
        ],
        cta: "Start Free",
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
          "Each channel you follow gets checked automatically through YouTube's RSS feed. The moment a new video appears, BriefTube reads its transcript, generates a summary, converts it to audio, and sends it to your Telegram — usually within a few minutes. No manual steps on your end.",
      },
      {
        question: "",
        answer:
          "Yeah, it is. We keep things lean: no big cloud infra, shared processing across users for the same video, free TTS. The goal was to build something I'd actually pay for myself, so the price had to make sense.",
      },
      {
        question: "Which languages work?",
        answer:
          "French and English voices are available right now. More are in the pipeline. If you're on Pro, you can pick a specific voice — there are a few to choose from in each language.",
      },
      {
        question: "Do I need to set up a Telegram bot?",
        answer:
          "No. You click a connect link, it opens @brief_tube_bot in Telegram, you send /start. That's the whole process — maybe 15 seconds if you type slowly.",
      },
      {
        question: "What happens if I cancel?",
        answer:
          "You drop back to the free plan — your channels stay, your history stays, you just lose access to the Pro features. No cancellation fees, no awkward retention flows.",
      },
    ],
  },
  finalCta: {
    heading: "Takes about 2 minutes to set up",
    subtitle: `Free for up to ${FREE} channels. No credit card, no commitment.`,
    ctaPrimary: "Sign Up Free",
    loginText: "Already have an account?",
    loginLink: "Log in",
  },
  footer: {
    privacy: "Privacy",
    terms: "Terms",
    copyright: (year: number) => `© ${year} BriefTube. All rights reserved.`,
  },
};
