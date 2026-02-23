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
];
