type PainPoint = {
  title: string;
  description: string;
};

type Step = {
  title: string;
  description: string;
};

type ProofStat = {
  value: string;
  label: string;
};

import { SiteConfig } from "@/site-config";

const FREE = SiteConfig.freeChannelsLimit;
const TRIAL = SiteConfig.trialDays;

export type LandingVariant = {
  slug: "commuter" | "backlog" | "speed" | "niche" | "telegram";
  pageTitle: string;
  pageDescription: string;
  hero: {
    headline: string;
    subheadline: string;
    ctaLabel: string;
    trustLine: string;
  };
  painPoints: [PainPoint, PainPoint, PainPoint];
  steps: [Step, Step, Step];
  proofStats: [ProofStat, ProofStat, ProofStat];
  bottomCta: {
    headline: string;
    subheadline: string;
    ctaLabel: string;
    urgencyNote?: string;
  };
};

export const landingVariants: LandingVariant[] = [
  {
    slug: "commuter",
    pageTitle: "Listen to YouTube summaries hands-free | BriefTube",
    pageDescription:
      "Turn your commute, workout, or cooking time into learning time. BriefTube delivers 2–3 minute audio summaries of your YouTube channels straight to Telegram.",
    hero: {
      headline:
        "Stop staring at your phone. Your summaries are already waiting.",
      subheadline:
        "While you're driving, at the gym, or cooking dinner — BriefTube is already summarizing the videos you care about. Audio drops to your Telegram before you even open YouTube.",
      ctaLabel: "Start listening for free",
      trustLine: `No credit card. ${FREE} channels free. Works in under 5 minutes.`,
    },
    painPoints: [
      {
        title: "Your eyes are busy, but your ears aren't",
        description:
          "You're commuting, cooking, or working out. You'd happily absorb content — but you can't watch a screen. Most YouTube tools assume you're sitting at a desk.",
      },
      {
        title: "You save videos and never watch them",
        description:
          "The Watch Later playlist is a graveyard. Channels you love keep uploading while you keep meaning to catch up. Meaning to, but not actually doing it.",
      },
      {
        title: "2x speed is still 45 minutes you don't have",
        description:
          "Even at double speed, a 90-minute podcast or deep-dive still takes real time. BriefTube condenses it to 2–3 minutes of the actual key points. Usually that's all you need.",
      },
    ],
    steps: [
      {
        title: "Subscribe to your channels",
        description: `Paste the channel URL or search by name. BriefTube monitors up to ${FREE} channels for free — channels like Kurzgesagt, Fireship, or your favorite finance creator.`,
      },
      {
        title: "Connect your Telegram",
        description:
          "One quick setup — open the BriefTube bot, send /start, and you're linked. Takes about 30 seconds.",
      },
      {
        title: "Listen whenever it suits you",
        description:
          "When a new video goes up, BriefTube summarizes it and sends a 2–3 minute audio file to your Telegram. Download once, play offline on your commute.",
      },
    ],
    proofStats: [
      { value: "3,400+", label: "channels tracked" },
      { value: "2–3 min", label: "audio per video" },
      { value: "< 5 min", label: "from upload to delivery" },
    ],
    bottomCta: {
      headline: "Your commute could be your most productive 20 minutes.",
      subheadline: `${FREE} channels, full audio summaries, delivered to Telegram — free, no card required.`,
      ctaLabel: "Start listening for free",
      urgencyNote: "Takes about 5 minutes to set up.",
    },
  },
  {
    slug: "backlog",
    pageTitle: "Kill your YouTube backlog for good | BriefTube",
    pageDescription:
      "That Watch Later list isn't going anywhere. BriefTube monitors your channels and delivers audio summaries to Telegram automatically — so the backlog becomes irrelevant.",
    hero: {
      headline: "That backlog isn't getting shorter. You know it isn't.",
      subheadline:
        "The Watch Later list grows faster than you can watch. BriefTube doesn't help you watch more — it makes watching unnecessary. Audio summaries arrive in your Telegram before you even think about catching up.",
      ctaLabel: "Stop the backlog today",
      trustLine: `Free for ${FREE} channels. No card. Setup in under 5 minutes.`,
    },
    painPoints: [
      {
        title: "Watch Later is a psychological burden",
        description:
          "Every unfinished video is a tiny piece of mental overhead. You saved it because you wanted to watch it — and now it's just sitting there, quietly judging you.",
      },
      {
        title: "Channels keep uploading whether you watch or not",
        description:
          "MrBallen, Wendover Productions, your favorite finance channel — they don't pause for you. By the time you clear 5 old videos, 8 new ones have appeared.",
      },
      {
        title: "You're missing things you actually care about",
        description:
          "When a channel you follow drops something important, you often don't know until days later — if at all. By then the conversation has moved on.",
      },
    ],
    steps: [
      {
        title: "Subscribe to the channels you actually care about",
        description: `Pick 1–${FREE} channels from your backlog pile. BriefTube monitors their RSS feeds and catches every new upload automatically.`,
      },
      {
        title: "Connect Telegram in 30 seconds",
        description:
          "Open the BriefTube bot, send /start. Done. New summaries land there, not in a dashboard you'll forget to check.",
      },
      {
        title: "Let the backlog become irrelevant",
        description:
          "You'll get a 2–3 minute audio summary of every new video. You stay current without watching. The backlog stops growing because you stop needing to catch up.",
      },
    ],
    proofStats: [
      { value: "3,400+", label: "channels tracked" },
      { value: "0", label: "videos to manually open" },
      { value: `${TRIAL}-day`, label: "free trial on Pro" },
    ],
    bottomCta: {
      headline: "The backlog stops here.",
      subheadline: `Monitor ${FREE} channels free. Audio summaries in Telegram. No catching up required.`,
      ctaLabel: "Stop the backlog today",
      urgencyNote:
        "No card required. Start free, upgrade if you want more channels.",
    },
  },
  {
    slug: "speed",
    pageTitle: "90-minute videos in 3 minutes | BriefTube",
    pageDescription:
      "2x speed is still slow. BriefTube compresses YouTube videos to their actual key points — 2–3 minute audio summaries delivered to Telegram automatically.",
    hero: {
      headline:
        "90-minute video. 3-minute audio. You didn't have to do anything.",
      subheadline:
        "Playing at 2x is still a 45-minute commitment. BriefTube extracts the actual key points and sends a 2–3 minute audio to your Telegram — automatically, when the video goes up.",
      ctaLabel: "Start compressing my content",
      trustLine: `Free for ${FREE} channels. No card. Ready in under 5 minutes.`,
    },
    painPoints: [
      {
        title: "2x speed is still slow",
        description:
          "A 90-minute video at double speed is still 45 minutes. You're still sitting there, still watching, still waiting for the 5 minutes of actual insight to arrive.",
      },
      {
        title: "You're watching filler, not content",
        description:
          "Most long YouTube videos are 30% actual content and 70% preamble, tangents, and sponsor reads. The insight is in there, just buried. BriefTube extracts it.",
      },
      {
        title: "Information debt compounds fast",
        description:
          "The channels you follow produce more than you can consume at any speed. The gap between 'uploaded' and 'you know about it' tends to keep growing.",
      },
    ],
    steps: [
      {
        title: "Add your highest-output channels",
        description:
          "The channels that upload long, dense videos are where BriefTube helps most. Think tech explainers, interview podcasts, finance deep-dives.",
      },
      {
        title: "Connect Telegram",
        description:
          "Link your account in about 30 seconds. Summaries arrive there, as audio files you can play at any speed, offline.",
      },
      {
        title: "Get the insight without the runtime",
        description:
          "New video appears. BriefTube summarizes it with Gemini AI and sends a 2–3 minute neural TTS audio to Telegram. You save roughly 97% of the original runtime.",
      },
    ],
    proofStats: [
      { value: "~97%", label: "time saved per video" },
      { value: "3,400+", label: "channels supported" },
      { value: "< 5 min", label: "from upload to delivery" },
    ],
    bottomCta: {
      headline: "Stop watching. Start knowing.",
      subheadline: `${FREE} channels free. Audio summaries in Telegram. No manual work, ever.`,
      ctaLabel: "Start compressing my content",
      urgencyNote: `No card required. Upgrade only if you want more than ${FREE} channels.`,
    },
  },
  {
    slug: "niche",
    pageTitle: "Passive intelligence on your niche | BriefTube",
    pageDescription:
      "Your competitors are uploading. BriefTube monitors YouTube channels in your niche and delivers audio summaries to Telegram — automatically, without you having to watch anything.",
    hero: {
      headline: "Your competitors are uploading. You're probably not watching.",
      subheadline:
        "Keeping up with your industry on YouTube takes hours you don't have. BriefTube monitors the channels that matter in your niche and delivers audio summaries to Telegram — so you stay ahead without watching.",
      ctaLabel: "Monitor my niche for free",
      trustLine: `Free for ${FREE} channels. No card. Up and running in under 5 minutes.`,
    },
    painPoints: [
      {
        title: "You can't watch everything in your space",
        description:
          "Between your own work and the sheer volume of content, manually monitoring competitor channels or thought leaders on YouTube just doesn't happen. Things slip through.",
      },
      {
        title: "Insights have a shelf life",
        description:
          "A trend spotted on Monday is old news by Friday. If you're catching up on a video that went up a week ago, the window to act on it has probably closed.",
      },
      {
        title: "Most of the video isn't relevant to you",
        description:
          "A 45-minute interview might have 3 minutes of genuinely useful signal for your work. BriefTube extracts that and ignores the rest.",
      },
    ],
    steps: [
      {
        title: "Pick your most important channels",
        description:
          "Add competitor channels, industry thought leaders, or analysts whose takes matter in your field. BriefTube starts monitoring immediately.",
      },
      {
        title: "Connect Telegram",
        description:
          "30-second setup. Summaries arrive in Telegram, where you probably already are — not in another dashboard to check.",
      },
      {
        title: "Stay ahead without actively monitoring",
        description:
          "Every new video from those channels gets summarized and sent to you as audio within a few minutes of upload. You hear about things as they happen.",
      },
    ],
    proofStats: [
      { value: "3,400+", label: "channels supported" },
      { value: "Unlimited", label: "channels on Pro" },
      { value: "< 5 min", label: "from upload to your Telegram" },
    ],
    bottomCta: {
      headline:
        "Know what's happening in your niche before everyone else does.",
      subheadline: `${FREE} channels free. Unlimited on Pro. Audio summaries, automatically, in Telegram.`,
      ctaLabel: "Monitor my niche for free",
      urgencyNote: "No card required. Add more channels anytime with Pro.",
    },
  },
  {
    slug: "telegram",
    pageTitle: "YouTube channels delivered to your Telegram | BriefTube",
    pageDescription:
      "If you live in Telegram, your YouTube subscriptions should be there too. BriefTube monitors channels and delivers 2–3 minute audio summaries automatically.",
    hero: {
      headline:
        "Your YouTube subscriptions, delivered like a newsletter. In Telegram.",
      subheadline:
        "You already live in Telegram — messages, channels, voice notes. BriefTube connects your YouTube subscriptions to it. New video goes up, 2–3 minute audio lands in your chat. No app switching, no manual work.",
      ctaLabel: "Connect my channels to Telegram",
      trustLine: `Free for ${FREE} channels. 30-second Telegram setup. No card required.`,
    },
    painPoints: [
      {
        title: "YouTube notifications are noise",
        description:
          "Bell icon, app notification, email digest — all competing for attention, none of them giving you the actual content. You still have to click through and watch.",
      },
      {
        title: "Switching apps to catch up doesn't happen",
        description:
          "You're in Telegram. YouTube is a separate world. The friction of switching — opening the app, finding the video, watching it — is enough to make you skip it most of the time.",
      },
      {
        title: "You want the content, not the video",
        description:
          "You subscribe because you care about what a creator has to say, not because you love watching videos. The audio format fits how you actually consume information.",
      },
    ],
    steps: [
      {
        title: "Add your YouTube channels",
        description: `Subscribe to the channels you want to follow — up to ${FREE} for free. Works with any public YouTube channel: tech, finance, news, productivity, whatever you follow.`,
      },
      {
        title: "Link BriefTube to your Telegram in 30 seconds",
        description:
          "Open the BriefTube bot in Telegram, send /start, done. Works in your personal chat or a group. Offline playback included.",
      },
      {
        title: "Receive summaries like messages",
        description:
          "New video appears on a channel you follow. BriefTube summarizes it with AI and sends a clean 2–3 minute audio file to your Telegram. It shows up like any other message.",
      },
    ],
    proofStats: [
      { value: "3,400+", label: "channels tracked" },
      { value: "Offline", label: "playback supported" },
      { value: "< 5 min", label: "from upload to Telegram" },
    ],
    bottomCta: {
      headline: "Your YouTube, finally inside Telegram.",
      subheadline: `${FREE} channels free. Connect in 30 seconds. Audio summaries, no app switching.`,
      ctaLabel: "Connect my channels to Telegram",
      urgencyNote: `Free forever for ${FREE} channels. Pro unlocks unlimited.`,
    },
  },
];
