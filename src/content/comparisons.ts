export type ComparisonData = {
  slug: string;
  competitor: string;
  title: string;
  description: string;
  lastUpdated: string;
  competitorDescription: string;
  table: {
    feature: string;
    briefTube: string | boolean;
    competitor: string | boolean;
  }[];
  verdict: string;
  competitorBestFor: string;
  briefTubeBestFor: string;
};

export const comparisons: ComparisonData[] = [
  {
    slug: "eightify",
    competitor: "Eightify",
    title: "BriefTube vs Eightify: which YouTube summarizer is right for you?",
    description:
      "Eightify is a Chrome extension for on-demand YouTube summaries. BriefTube monitors your channels and delivers audio automatically. Different tools for different needs.",
    lastUpdated: "2026-02-24",
    competitorDescription:
      "Eightify is a browser extension that summarizes individual YouTube videos on demand using GPT. You click a button while watching, and it generates a text summary in the sidebar.",
    table: [
      {
        feature: "Automatic monitoring",
        briefTube: "Yes, monitors RSS feeds",
        competitor: "No — manual per video",
      },
      {
        feature: "Audio output",
        briefTube: "Yes, neural TTS audio",
        competitor: "Text only",
      },
      {
        feature: "Telegram delivery",
        briefTube: "Yes, delivered to Telegram",
        competitor: "No",
      },
      {
        feature: "Works without watching",
        briefTube: "Yes",
        competitor: "Requires you to open the video",
      },
      {
        feature: "Chrome extension required",
        briefTube: "No",
        competitor: "Yes",
      },
      {
        feature: "Free tier",
        briefTube: "3 channels free",
        competitor: "Limited free, paid from $7/month",
      },
      {
        feature: "Multi-language audio",
        briefTube: "Yes (FR, EN)",
        competitor: "Text in English",
      },
    ],
    verdict:
      "If you watch YouTube actively and want quick summaries while browsing, Eightify is convenient. If you want to stay updated on specific channels without actively watching at all, BriefTube does something Eightify can't — it monitors your channels and proactively sends you audio.",
    competitorBestFor:
      "Active YouTube viewers who want quick summaries while browsing",
    briefTubeBestFor:
      "People who want to consume channel content passively, as audio, without opening YouTube",
  },
  {
    slug: "notegpt",
    competitor: "NoteGPT",
    title: "BriefTube vs NoteGPT: automatic delivery vs on-demand summaries",
    description:
      "NoteGPT is a web app for summarizing YouTube videos and taking notes. BriefTube focuses on passive monitoring and Telegram audio delivery.",
    lastUpdated: "2026-02-24",
    competitorDescription:
      "NoteGPT is a web-based tool that lets you paste a YouTube URL and get a text summary, transcript, and note-taking features. It supports multiple content types beyond YouTube.",
    table: [
      {
        feature: "Automatic channel monitoring",
        briefTube: "Yes",
        competitor: "No — paste URL manually",
      },
      {
        feature: "Audio delivery",
        briefTube: "Yes, neural TTS to Telegram",
        competitor: "No",
      },
      {
        feature: "Note-taking features",
        briefTube: "No",
        competitor: "Yes — highlights, flashcards",
      },
      {
        feature: "Telegram integration",
        briefTube: "Yes",
        competitor: "No",
      },
      {
        feature: "Non-YouTube content",
        briefTube: "No",
        competitor: "Yes (PDFs, web pages)",
      },
      {
        feature: "Free tier",
        briefTube: "3 channels free",
        competitor: "Limited free credits",
      },
      {
        feature: "Use case",
        briefTube: "Stay updated on channels",
        competitor: "Research and note-taking",
      },
    ],
    verdict:
      "NoteGPT is a solid research and note-taking tool if you actively want to process content. BriefTube is for a different need: staying updated on YouTube channels without active effort. They barely overlap.",
    competitorBestFor:
      "Students and researchers who want to extract structured notes from specific videos",
    briefTubeBestFor:
      "Anyone who follows YouTube channels and wants to keep up passively via audio",
  },
  {
    slug: "kagi",
    competitor: "Kagi Summarizer",
    title:
      "BriefTube vs Kagi Summarizer: automatic audio delivery vs on-demand text",
    description:
      "Kagi Summarizer handles any URL on demand. BriefTube monitors YouTube channels and delivers audio automatically. Two different approaches to the same problem.",
    lastUpdated: "2026-03-03",
    competitorDescription:
      "Kagi Summarizer is a feature of the Kagi search engine that generates instant text summaries of any URL — articles, YouTube videos, PDFs. It's pay-per-use with no subscription required, and produces clean, readable output.",
    table: [
      {
        feature: "Automatic channel monitoring",
        briefTube: "Yes, RSS-based",
        competitor: "No — paste URL manually",
      },
      {
        feature: "Audio output",
        briefTube: "Yes, neural TTS",
        competitor: "Text only",
      },
      {
        feature: "Telegram delivery",
        briefTube: "Yes",
        competitor: "No",
      },
      {
        feature: "Supports any URL type",
        briefTube: "YouTube only",
        competitor: "Yes (articles, PDFs, videos)",
      },
      {
        feature: "Price model",
        briefTube: "Monthly subscription",
        competitor: "Pay-per-use or Kagi subscription",
      },
      {
        feature: "Works without YouTube account",
        briefTube: "Yes",
        competitor: "Yes",
      },
      {
        feature: "Free tier",
        briefTube: "5 channels free",
        competitor: "100 free queries then paid",
      },
    ],
    verdict:
      "Kagi is a powerful tool if you need on-demand summaries of varied content types. BriefTube is purpose-built for YouTube channel monitoring — it works without any input once set up. Different tools for different workflows.",
    competitorBestFor:
      "Users who summarize diverse content types (articles, PDFs, occasional videos) on demand",
    briefTubeBestFor:
      "Anyone who follows specific YouTube channels and wants automatic audio summaries without manual effort",
  },
  {
    slug: "glasp",
    competitor: "Glasp",
    title:
      "BriefTube vs Glasp: passive audio delivery vs active web highlighting",
    description:
      "Glasp is a social web highlighter with YouTube transcript summaries. BriefTube automates the entire process and delivers audio to Telegram.",
    lastUpdated: "2026-03-03",
    competitorDescription:
      "Glasp is a Chrome extension and web app for highlighting and summarizing web content, including YouTube transcripts. It has a social layer where you can follow other users and see their highlights. It integrates with ChatGPT for AI summaries.",
    table: [
      {
        feature: "Automatic monitoring",
        briefTube: "Yes",
        competitor: "No — manual per page",
      },
      {
        feature: "Audio output",
        briefTube: "Yes, neural TTS to Telegram",
        competitor: "No",
      },
      {
        feature: "Social/community features",
        briefTube: "No",
        competitor: "Yes — follow users, shared highlights",
      },
      {
        feature: "Telegram integration",
        briefTube: "Yes",
        competitor: "No",
      },
      {
        feature: "Highlights and annotations",
        briefTube: "No",
        competitor: "Yes — core feature",
      },
      {
        feature: "Chrome extension required",
        briefTube: "No",
        competitor: "Yes",
      },
      {
        feature: "Free tier",
        briefTube: "5 channels free",
        competitor: "Free with limits",
      },
    ],
    verdict:
      "Glasp is built for active readers who want to annotate and share knowledge. BriefTube is for passive consumption — it delivers what's new from your channels without you doing anything. Opposite philosophies.",
    competitorBestFor:
      "Active readers who want to collect, annotate, and share knowledge from multiple sources",
    briefTubeBestFor:
      "People who want to keep up with YouTube channels passively, as audio, delivered automatically",
  },
  {
    slug: "merlin",
    competitor: "Merlin AI",
    title: "BriefTube vs Merlin AI: channel automation vs browser AI assistant",
    description:
      "Merlin is an AI assistant that works anywhere in your browser. BriefTube focuses specifically on automated YouTube channel monitoring and audio delivery.",
    lastUpdated: "2026-03-03",
    competitorDescription:
      "Merlin AI is a browser extension that brings AI capabilities to any website — summarize pages, chat with documents, generate content, summarize YouTube videos. It's a general-purpose AI assistant for the browser.",
    table: [
      {
        feature: "Automatic channel monitoring",
        briefTube: "Yes",
        competitor: "No — manual trigger",
      },
      {
        feature: "Audio delivery to Telegram",
        briefTube: "Yes",
        competitor: "No",
      },
      {
        feature: "General AI assistant features",
        briefTube: "No",
        competitor: "Yes — chat, write, search",
      },
      {
        feature: "Works across all websites",
        briefTube: "YouTube only",
        competitor: "Yes",
      },
      {
        feature: "No browser extension needed",
        briefTube: "Yes",
        competitor: "No — requires extension",
      },
      {
        feature: "Free tier",
        briefTube: "5 channels free",
        competitor: "102 free queries/day",
      },
      {
        feature: "Multi-language summaries",
        briefTube: "Yes (55 languages)",
        competitor: "English primarily",
      },
    ],
    verdict:
      "Merlin is a broad AI browser assistant — useful for many tasks but not specialized. BriefTube does one thing: monitor your YouTube channels and deliver audio summaries automatically. If YouTube subscriptions are your focus, BriefTube is more purpose-built.",
    competitorBestFor:
      "Users who want an all-in-one AI assistant for browsing, writing, and occasional video summaries",
    briefTubeBestFor:
      "YouTube subscribers who want automated audio summaries delivered to Telegram without browser extensions",
  },
  {
    slug: "tubesummary",
    competitor: "TubeSummary",
    title:
      "BriefTube vs TubeSummary: automated delivery vs on-demand web summaries",
    description:
      "TubeSummary generates text summaries of individual YouTube videos. BriefTube monitors entire channels and delivers audio automatically.",
    lastUpdated: "2026-03-03",
    competitorDescription:
      "TubeSummary is a web tool that generates AI text summaries from YouTube video URLs. You paste a URL, get a summary. Simple, fast, no account required for basic use.",
    table: [
      {
        feature: "Channel monitoring",
        briefTube: "Yes, RSS-based automatic",
        competitor: "No",
      },
      {
        feature: "Audio output",
        briefTube: "Yes, neural TTS",
        competitor: "No — text only",
      },
      {
        feature: "Telegram delivery",
        briefTube: "Yes",
        competitor: "No",
      },
      {
        feature: "No account needed",
        briefTube: "Account required",
        competitor: "Yes for basic use",
      },
      {
        feature: "On-demand single video",
        briefTube: "No — channel subscription model",
        competitor: "Yes",
      },
      {
        feature: "Free tier",
        briefTube: "5 channels free",
        competitor: "Limited free summaries",
      },
    ],
    verdict:
      "TubeSummary is the simplest possible tool — paste URL, get text. No commitment. BriefTube requires setup but automates everything after that. If you watch videos occasionally, TubeSummary is fine. If you follow specific channels, BriefTube saves more time.",
    competitorBestFor:
      "Casual users who occasionally want a quick text summary of a specific video without signing up",
    briefTubeBestFor:
      "Regular YouTube consumers who follow channels and want audio summaries delivered automatically",
  },
  {
    slug: "mindgrasp",
    competitor: "Mindgrasp",
    title:
      "BriefTube vs Mindgrasp: YouTube audio automation vs multi-format learning tool",
    description:
      "Mindgrasp handles documents, lectures, and videos for students. BriefTube automates YouTube channel monitoring with audio delivery to Telegram.",
    lastUpdated: "2026-03-03",
    competitorDescription:
      "Mindgrasp is an AI learning tool designed for students and professionals. It can summarize PDFs, lecture recordings, YouTube videos, and more, generating notes, flashcards, and Q&A from any uploaded content.",
    table: [
      {
        feature: "Automatic YouTube monitoring",
        briefTube: "Yes",
        competitor: "No — manual upload",
      },
      {
        feature: "Audio delivery to Telegram",
        briefTube: "Yes",
        competitor: "No",
      },
      {
        feature: "Flashcards and study notes",
        briefTube: "No",
        competitor: "Yes",
      },
      {
        feature: "Supports PDFs and documents",
        briefTube: "No",
        competitor: "Yes",
      },
      {
        feature: "Designed for passive consumption",
        briefTube: "Yes",
        competitor: "No — active study tool",
      },
      {
        feature: "Free tier",
        briefTube: "5 channels free",
        competitor: "Limited trial",
      },
    ],
    verdict:
      "Mindgrasp is built for learning from structured content — courses, lectures, documents. BriefTube is for staying updated on YouTube channels passively. If you're a student processing content, Mindgrasp. If you follow YouTube creators, BriefTube.",
    competitorBestFor:
      "Students and professionals who need to process educational content with notes and flashcards",
    briefTubeBestFor:
      "YouTube subscribers who want to stay updated on channels they follow through automatic audio summaries",
  },
  {
    slug: "tactiq",
    competitor: "Tactiq",
    title:
      "BriefTube vs Tactiq: YouTube automation vs meeting and video transcription",
    description:
      "Tactiq transcribes meetings and videos for work. BriefTube automatically monitors YouTube channels and delivers audio summaries to Telegram.",
    lastUpdated: "2026-03-03",
    competitorDescription:
      "Tactiq is a Chrome extension that transcribes and summarizes Google Meet, Zoom, and YouTube videos in real time. It's primarily used in professional settings for meeting notes and action items.",
    table: [
      {
        feature: "Automatic channel monitoring",
        briefTube: "Yes",
        competitor: "No",
      },
      {
        feature: "Telegram delivery",
        briefTube: "Yes",
        competitor: "No",
      },
      {
        feature: "Meeting transcription (Zoom, Meet)",
        briefTube: "No",
        competitor: "Yes — core feature",
      },
      {
        feature: "Real-time transcription",
        briefTube: "No",
        competitor: "Yes",
      },
      {
        feature: "Chrome extension required",
        briefTube: "No",
        competitor: "Yes",
      },
      {
        feature: "Use case",
        briefTube: "YouTube channel consumption",
        competitor: "Work meetings + video content",
      },
      {
        feature: "Free tier",
        briefTube: "5 channels free",
        competitor: "5 free transcripts/month",
      },
    ],
    verdict:
      "Tactiq and BriefTube barely overlap. Tactiq is for work — capturing meeting notes and action items. BriefTube is for personal learning — staying current on YouTube channels. If you're trying to decide between them, you probably need both for different reasons.",
    competitorBestFor:
      "Professionals who need real-time meeting transcription and post-meeting summaries",
    briefTubeBestFor:
      "YouTube consumers who want automated audio summaries of their subscribed channels delivered to Telegram",
  },
  {
    slug: "podwise",
    competitor: "Podwise",
    title:
      "BriefTube vs Podwise: YouTube channel automation vs podcast summarization",
    description:
      "Podwise summarizes podcast episodes automatically. BriefTube does the same for YouTube channels, with audio delivery to Telegram.",
    lastUpdated: "2026-03-03",
    competitorDescription:
      "Podwise is an AI tool that automatically subscribes to podcast RSS feeds and generates text summaries, transcripts, and key insights for each new episode. It delivers a digest to your inbox or dashboard.",
    table: [
      {
        feature: "YouTube channel monitoring",
        briefTube: "Yes",
        competitor: "No — podcast RSS only",
      },
      {
        feature: "Podcast monitoring",
        briefTube: "No",
        competitor: "Yes — core feature",
      },
      {
        feature: "Audio output",
        briefTube: "Yes, TTS audio to Telegram",
        competitor: "Text summaries + transcripts",
      },
      {
        feature: "Telegram delivery",
        briefTube: "Yes",
        competitor: "Email digest",
      },
      {
        feature: "Automatic monitoring",
        briefTube: "Yes",
        competitor: "Yes",
      },
      {
        feature: "Free tier",
        briefTube: "5 channels free",
        competitor: "3 podcasts free",
      },
    ],
    verdict:
      "Podwise and BriefTube are conceptually the same product for different content formats — podcasts vs YouTube. If your backlog is podcasts, use Podwise. If it's YouTube channels, use BriefTube. They're complementary rather than competitive.",
    competitorBestFor:
      "Podcast listeners who want automated text summaries and transcripts of new episodes",
    briefTubeBestFor:
      "YouTube subscribers who want automated audio summaries of new video content delivered to Telegram",
  },
  {
    slug: "snipd",
    competitor: "Snipd",
    title:
      "BriefTube vs Snipd: YouTube automation vs AI-powered podcast player",
    description:
      "Snipd is an AI podcast player for capturing insights while listening. BriefTube automates YouTube channel monitoring and delivers audio to Telegram.",
    lastUpdated: "2026-03-03",
    competitorDescription:
      "Snipd is a podcast player with AI features: it generates chapter summaries, lets you clip highlights by shaking your phone, and creates shareable snippets. It focuses on helping podcast listeners capture and retain knowledge.",
    table: [
      {
        feature: "YouTube channel support",
        briefTube: "Yes",
        competitor: "No — podcasts only",
      },
      {
        feature: "Audio summaries",
        briefTube: "Yes — TTS delivered to Telegram",
        competitor: "Chapter summaries within app",
      },
      {
        feature: "Telegram delivery",
        briefTube: "Yes",
        competitor: "No — in-app only",
      },
      {
        feature: "Highlight clipping",
        briefTube: "No",
        competitor: "Yes — shake to clip",
      },
      {
        feature: "Automatic new content detection",
        briefTube: "Yes, RSS",
        competitor: "Yes, podcast RSS",
      },
      {
        feature: "Mobile app",
        briefTube: "Via Telegram",
        competitor: "Yes, dedicated iOS/Android app",
      },
      {
        feature: "Free tier",
        briefTube: "5 channels free",
        competitor: "Free with limits",
      },
    ],
    verdict:
      "Snipd is excellent for podcast listeners who want to capture and retain insights while listening. BriefTube is for YouTube consumers who want audio summaries delivered without effort. They don't compete — if you follow both YouTube channels and podcasts, you might want both.",
    competitorBestFor:
      "Active podcast listeners who want to capture specific insights and highlights while listening",
    briefTubeBestFor:
      "YouTube followers who want automated audio summaries of new videos delivered passively to Telegram",
  },
];
