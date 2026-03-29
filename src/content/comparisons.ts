import { SiteConfig } from "@/site-config";

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
      "Eightify helps when you're actively watching YouTube—click the button, get a quick text summary in your sidebar. BriefTube works differently: it watches your channels for you and sends audio summaries automatically, wherever you listen. Choose based on your workflow, not the tool.",
    lastUpdated: "2026-02-24",
    competitorDescription:
      "Eightify is a browser extension that uses GPT to summarize YouTube videos while you're watching. Click a button, and it drops a text summary right in your sidebar. No setup, no commitment—you decide when to use it.",
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
        feature: "Push delivery",
        briefTube: "Yes, Telegram, Discord, Slack, podcast RSS",
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
        briefTube: `${SiteConfig.freeChannelsLimit} channels free`,
        competitor: "Limited free, paid from $4.99/month (annual)",
      },
      {
        feature: "Multi-language audio",
        briefTube: "Yes (FR, EN)",
        competitor: "Text in English",
      },
    ],
    verdict:
      "Eightify shines if you're already watching videos and want a quick text snapshot. But if you'd rather have YouTube keep up with you—not the other way around—BriefTube removes that friction entirely. You get audio delivered wherever you listen without lifting a finger.",
    competitorBestFor:
      "People who actively watch YouTube and like having context before diving deeper into a video",
    briefTubeBestFor:
      "Anyone who follows channels but doesn't have time to actually watch videos—you get the audio while commuting or doing other tasks",
  },
  {
    slug: "notegpt",
    competitor: "NoteGPT",
    title: "BriefTube vs NoteGPT: automatic delivery vs on-demand summaries",
    description:
      "NoteGPT is built for research—paste a video URL and extract structured notes, highlights, and flashcards. BriefTube is built for staying current—it watches your channels and pushes audio summaries to you automatically. Different mindsets entirely.",
    lastUpdated: "2026-02-24",
    competitorDescription:
      "NoteGPT is a web app for extracting knowledge from content. Paste a YouTube URL (or PDF, article, etc.) and get text summaries, full transcripts, and note-taking tools—useful when you're actively processing something you want to learn from.",
    table: [
      {
        feature: "Automatic channel monitoring",
        briefTube: "Yes",
        competitor: "No — paste URL manually",
      },
      {
        feature: "Audio delivery",
        briefTube: "Yes, neural TTS to Telegram, Discord, Slack",
        competitor: "No",
      },
      {
        feature: "Note-taking features",
        briefTube: "No",
        competitor: "Yes — highlights, flashcards",
      },
      {
        feature: "Push delivery",
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
        briefTube: `${SiteConfig.freeChannelsLimit} channels free`,
        competitor: "15 free uses/month, paid from $2.99/month",
      },
      {
        feature: "Use case",
        briefTube: "Stay updated on channels",
        competitor: "Research and note-taking",
      },
    ],
    verdict:
      "These really don't compete. NoteGPT is for the moments when you actively choose to deep-dive into content. BriefTube is for staying aware of channels you care about without any extra work. You might use both for different reasons—NoteGPT for research, BriefTube for staying current.",
    competitorBestFor:
      "Students, researchers, or anyone who needs to extract knowledge and study material from specific content",
    briefTubeBestFor:
      "People who subscribe to channels but never actually have time to watch, and want audio summaries instead",
  },
  {
    slug: "kagi",
    competitor: "Kagi Summarizer",
    title:
      "BriefTube vs Kagi Summarizer: automatic audio delivery vs on-demand text",
    description:
      "Kagi Summarizer is a Swiss Army knife for summarizing—throw any URL at it, get a clean text summary instantly. BriefTube is specialized: it automates YouTube channels specifically and converts summaries to audio. One is a tool for ad-hoc questions, the other is a set-it-and-forget-it system.",
    lastUpdated: "2026-03-03",
    competitorDescription:
      "Kagi Summarizer is built into the Kagi search engine and handles anything with a URL—articles, PDFs, YouTube videos, you name it. Paste the link, get a crisp text summary. No subscription needed; you pay per query. The summaries are actually readable, which is refreshing.",
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
        feature: "Push delivery",
        briefTube: "Telegram, Discord, Slack, podcast RSS",
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
        briefTube: `${SiteConfig.freeChannelsLimit} channels free`,
        competitor: "100 free queries then paid",
      },
    ],
    verdict:
      "Kagi is your tool when you need a fast answer about something specific right now. BriefTube is your tool when you want your channels to come to you automatically as audio. Kagi feels like asking a question; BriefTube feels like staying informed without asking.",
    competitorBestFor:
      "People who frequently need to quickly summarize different types of content—articles, PDFs, videos—on the fly",
    briefTubeBestFor:
      "YouTube channel subscribers who want new content summarized and delivered as audio without doing anything",
  },
  {
    slug: "glasp",
    competitor: "Glasp",
    title:
      "BriefTube vs Glasp: passive audio delivery vs active web highlighting",
    description:
      "Glasp is about collecting and sharing what you find—highlight passages, see what others highlighted, build a knowledge library. BriefTube is about not having to search at all—your channels push summaries to you as audio. One is pull-based, the other is push-based.",
    lastUpdated: "2026-03-03",
    competitorDescription:
      "Glasp combines highlighting and summarization with a social angle. Install the extension, highlight passages while reading, get AI summaries, and see what other Glasp users thought was worth saving. It's built for people who want to collect and learn from what they find.",
    table: [
      {
        feature: "Automatic monitoring",
        briefTube: "Yes",
        competitor: "No — manual per page",
      },
      {
        feature: "Audio output",
        briefTube: "Yes, neural TTS to Telegram, Discord, Slack",
        competitor: "No",
      },
      {
        feature: "Social/community features",
        briefTube: "No",
        competitor: "Yes — follow users, shared highlights",
      },
      {
        feature: "Push delivery",
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
        briefTube: `${SiteConfig.freeChannelsLimit} channels free`,
        competitor: "Free with limits",
      },
    ],
    verdict:
      "Glasp assumes you're actively reading and wants you to organize what you find. BriefTube assumes you're busy and brings your channels to you. They're almost philosophical opposites—one is for knowledge workers, the other is for people who just want to stay aware.",
    competitorBestFor:
      "Active readers and students who want to highlight, annotate, and organize what they discover",
    briefTubeBestFor:
      "Busy people who follow YouTube channels but need summaries in audio form delivered automatically wherever they listen",
  },
  {
    slug: "merlin",
    competitor: "Merlin AI",
    title: "BriefTube vs Merlin AI: channel automation vs browser AI assistant",
    description:
      "Merlin is a jack-of-all-trades browser extension—summarize anything, chat with PDFs, write content. BriefTube does one specific thing well: monitor YouTube channels and send you audio summaries automatically. Generalist versus specialist.",
    lastUpdated: "2026-03-03",
    competitorDescription:
      "Merlin AI is a browser extension that acts like an AI assistant for everything. Need to summarize a page? Chat with a document? Generate content? Merlin can handle it all, including occasional YouTube video summaries. It's useful when you want AI help without leaving your browser.",
    table: [
      {
        feature: "Automatic channel monitoring",
        briefTube: "Yes",
        competitor: "No — manual trigger",
      },
      {
        feature: "Audio push delivery",
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
        briefTube: `${SiteConfig.freeChannelsLimit} channels free`,
        competitor: "102 free queries/day",
      },
      {
        feature: "Multi-language summaries",
        briefTube: "Yes (55 languages)",
        competitor: "English primarily",
      },
    ],
    verdict:
      "Merlin is valuable if you need a general AI sidekick in your browser. But if your main problem is keeping up with YouTube channels, Merlin feels like overkill—BriefTube solves that specific problem with zero friction. You set up channels once and forget.",
    competitorBestFor:
      "Power users who want quick AI help for writing, research, and various summarization tasks across the web",
    briefTubeBestFor:
      "YouTube subscribers who want audio summaries automatically sent to them, no extension required, no extra steps",
  },
  {
    slug: "tubesummary",
    competitor: "TubeSummary",
    title:
      "BriefTube vs TubeSummary: automated delivery vs on-demand web summaries",
    description:
      "TubeSummary is as minimal as it gets—paste a YouTube URL, read a text summary, move on. No account, no commitment. BriefTube is the opposite end: add channels once, get audio summaries automatically. Choose based on how much you value your time.",
    lastUpdated: "2026-03-03",
    competitorDescription:
      "TubeSummary keeps it simple: paste a YouTube URL into their web tool and get back a text summary. No signup needed, no accounts, no recurring costs. Works fast and stays out of the way—if you only need summaries occasionally, this minimal approach is honestly appealing.",
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
        feature: "Push delivery",
        briefTube: "Telegram, Discord, Slack, podcast RSS",
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
        briefTube: `${SiteConfig.freeChannelsLimit} channels free`,
        competitor: "Limited free summaries",
      },
    ],
    verdict:
      "TubeSummary wins on speed and zero commitment. But if you follow channels regularly, manually pasting URLs gets old fast. BriefTube asks you to spend 2 minutes setting things up, then saves you hours of pasting and reading later.",
    competitorBestFor:
      "Casual YouTube watchers who want a quick text summary of a random video without any signup or commitment",
    briefTubeBestFor:
      "Regular YouTube subscribers who follow specific channels and want audio summaries pushed to them automatically",
  },
  {
    slug: "mindgrasp",
    competitor: "Mindgrasp",
    title:
      "BriefTube vs Mindgrasp: YouTube audio automation vs multi-format learning tool",
    description:
      "Mindgrasp is designed for students who need to extract knowledge from lectures, PDFs, and videos—it gives you flashcards and study notes. BriefTube is for people who just want to stay informed about YouTube channels they care about. Different learner profiles entirely.",
    lastUpdated: "2026-03-03",
    competitorDescription:
      "Mindgrasp is built for students and professionals who need to learn from content. Upload PDFs, lecture recordings, YouTube videos—and it generates study materials like flashcards, Q&A, and organized notes. It's for active learning, not passive consumption.",
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
        briefTube: `${SiteConfig.freeChannelsLimit} channels free`,
        competitor: "Limited trial",
      },
    ],
    verdict:
      "Mindgrasp is for when you're trying to learn something—you upload material and get study aids. BriefTube is for when you just want to know what's happening in your favorite channels. They target different mindsets: active learning versus passive awareness.",
    competitorBestFor:
      "Students and professionals working through courses, lectures, and reference materials to develop expertise",
    briefTubeBestFor:
      "YouTube channel subscribers who want to stay informed through audio summaries without actively studying",
  },
  {
    slug: "tactiq",
    competitor: "Tactiq",
    title:
      "BriefTube vs Tactiq: YouTube automation vs meeting and video transcription",
    description:
      "Tactiq helps you capture what happens in real time—meetings, calls, live videos. You're present, and it records everything. BriefTube is for content that happens without you. You subscribe to channels, and summaries come to you automatically. One is about capturing, the other is about staying informed.",
    lastUpdated: "2026-03-03",
    competitorDescription:
      "Tactiq transcribes meetings and videos as they happen—Zoom calls, Google Meet sessions, live YouTube streams. It's designed for professionals who need to capture and organize what was said. Real-time transcription feels essential when you're in the moment.",
    table: [
      {
        feature: "Automatic channel monitoring",
        briefTube: "Yes",
        competitor: "No",
      },
      {
        feature: "Push delivery",
        briefTube: "Telegram, Discord, Slack, podcast RSS",
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
        briefTube: `${SiteConfig.freeChannelsLimit} channels free`,
        competitor: "5 free transcripts/month",
      },
    ],
    verdict:
      "These really don't compete—one is for capturing what you're actively in, the other is for staying aware of what you're following. Tactiq feels indispensable if you're in meetings; BriefTube feels indispensable if you follow creators. You might use both, but for completely different reasons.",
    competitorBestFor:
      "Professionals and meeting participants who need to capture and transcribe real-time conversations and calls",
    briefTubeBestFor:
      "YouTube channel followers who want audio summaries delivered passively to Telegram without opening the app",
  },
  {
    slug: "podwise",
    competitor: "Podwise",
    title:
      "BriefTube vs Podwise: YouTube channel automation vs podcast summarization",
    description:
      "Both automate monitoring and generate summaries. Podwise is for podcast listeners; BriefTube is for YouTube watchers. Same concept, different medium. If you follow both podcasts and YouTube channels, you might end up using both—they complement each other.",
    lastUpdated: "2026-03-03",
    competitorDescription:
      "Podwise automates podcast monitoring—it subscribes to RSS feeds and automatically summarizes each new episode, then sends digests to your inbox or dashboard. Useful if you follow podcasts but never have time to actually listen.",
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
        briefTube: "Yes, TTS audio to Telegram, Discord, Slack",
        competitor: "Text summaries + transcripts",
      },
      {
        feature: "Push delivery",
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
        briefTube: `${SiteConfig.freeChannelsLimit} channels free`,
        competitor: "3 podcasts free",
      },
    ],
    verdict:
      "They're really the same idea split across different content. Like Podwise for YouTube? That's BriefTube. Like BriefTube for podcasts? That's Podwise. If your backlog is mixed—some podcasts, some channels—you could use both without conflict.",
    competitorBestFor:
      "Podcast listeners who want summaries and digests automatically delivered so they can stay aware without time commitment",
    briefTubeBestFor:
      "YouTube channel subscribers who want audio summaries delivered automatically so they can stay current hands-free",
  },
  {
    slug: "snipd",
    competitor: "Snipd",
    title:
      "BriefTube vs Snipd: YouTube automation vs AI-powered podcast player",
    description:
      "Snipd is built around actual podcast listening—you play episodes in their app and capture moments that matter to you. BriefTube is built for people who don't have time to listen to all their videos. One assumes engagement; the other assumes time scarcity.",
    lastUpdated: "2026-03-03",
    competitorDescription:
      "Snipd is a podcast player that does more than just play audio. It summarizes chapters, lets you clip highlights (literally shake your phone), and makes it easy to find and share the moments that resonated with you. It's designed for people who actually have time to listen.",
    table: [
      {
        feature: "YouTube channel support",
        briefTube: "Yes",
        competitor: "No — podcasts only",
      },
      {
        feature: "Audio summaries",
        briefTube: "Yes, TTS delivered to Telegram, Discord, Slack",
        competitor: "Chapter summaries within app",
      },
      {
        feature: "Push delivery",
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
        briefTube: "Via Telegram, Discord, or Slack",
        competitor: "Yes, dedicated iOS/Android app",
      },
      {
        feature: "Free tier",
        briefTube: `${SiteConfig.freeChannelsLimit} channels free`,
        competitor: "Free with limits",
      },
    ],
    verdict:
      "Snipd assumes you're actively listening and want to capture moments. BriefTube assumes you're too busy to listen and wants to serve you summaries anyway. They're not even in the same lane. Use Snipd if you have time for podcasts; use BriefTube if you don't have time for YouTube.",
    competitorBestFor:
      "Dedicated podcast listeners who want to capture highlights and share insights while actually listening to episodes",
    briefTubeBestFor:
      "Busy YouTube subscribers who want summaries delivered as audio automatically without dedicating active listening time",
  },
  {
    slug: "tubeonai",
    competitor: "TubeOnAI",
    title:
      "BriefTube vs TubeOnAI: which automated YouTube summarizer is right for you?",
    description:
      "TubeOnAI and BriefTube solve the same problem—monitoring channels and generating audio—but in different philosophies. TubeOnAI wants to be your main app for all content. BriefTube wants to be invisible: summaries arrive wherever you already are. One is a content hub; the other is a notification system.",
    lastUpdated: "2026-03-07",
    competitorDescription:
      "TubeOnAI is an all-in-one content hub: monitor YouTube channels, podcasts, articles, PDFs—all in one place. New content gets summarized automatically, and you can listen to the audio summaries right inside their app. It's designed to become your content consumption center.",
    table: [
      {
        feature: "Automatic channel monitoring",
        briefTube: "Yes, RSS-based",
        competitor: "Yes",
      },
      {
        feature: "Audio summaries",
        briefTube: "Yes — Microsoft Edge neural TTS",
        competitor: "Yes — in-app TTS",
      },
      {
        feature: "Push delivery",
        briefTube: "Yes, Telegram, Discord, Slack, podcast RSS",
        competitor: "No — in-app only, must open their app",
      },
      {
        feature: "Podcast support",
        briefTube: "No",
        competitor: "Yes",
      },
      {
        feature: "Voice languages",
        briefTube: "55 languages via Microsoft Edge",
        competitor: "20 languages",
      },
      {
        feature: "Pricing",
        briefTube: `Free (${SiteConfig.freeChannelsLimit} channels), Pro unlimited`,
        competitor: "Free limited, then $20/month",
      },
      {
        feature: "Requires dedicated app",
        briefTube: "No — summaries come to you",
        competitor: "Yes — must open TubeOnAI app or website",
      },
    ],
    verdict:
      "TubeOnAI is probably the closest competitor—both automate channels and create audio. But the philosophy is different: TubeOnAI wants to become your app, asking you to open it and listen. BriefTube wants to vanish, pushing summaries directly to you wherever you already are. If you follow both YouTube and podcasts and enjoy dedicated apps, TubeOnAI wins. If you just want summaries without opening another app, BriefTube wins.",
    competitorBestFor:
      "Users who follow both YouTube channels and podcasts and want everything in one dedicated app for content",
    briefTubeBestFor:
      "YouTube subscribers who want summaries delivered wherever they already are, no app switching, just audio files",
  },
  {
    slug: "snipcast",
    competitor: "Snipcast",
    title: "BriefTube vs Snipcast: audio push delivery vs text email digests",
    description:
      "Both automate monitoring and deliver summaries. Snipcast sends text to your email inbox with a hard cap of 10 channels; BriefTube sends audio to Telegram, Discord, or Slack with unlimited channels on Pro. Different mediums, different limits. It comes down to how you prefer to consume content and whether you have a channel cap ceiling.",
    lastUpdated: "2026-03-07",
    competitorDescription:
      "Snipcast monitors YouTube channels and podcasts, then emails you text summaries of new content. It supports Spotify and Apple Podcasts too. The paid tier ($5.99/month) lets you follow up to 10 subscriptions with full transcripts. Built for inbox-based discovery.",
    table: [
      {
        feature: "Automatic channel monitoring",
        briefTube: "Yes",
        competitor: "Yes",
      },
      {
        feature: "Audio output",
        briefTube: "Yes — neural TTS audio file",
        competitor: "No — text only",
      },
      {
        feature: "Delivery channel",
        briefTube: "Telegram, Discord, Slack (audio)",
        competitor: "Email (text digest)",
      },
      {
        feature: "Max channel subscriptions",
        briefTube: "5 free, unlimited on Pro",
        competitor: "2 free, 10 max on paid plan",
      },
      {
        feature: "Podcast support",
        briefTube: "No",
        competitor: "Yes — Spotify, Apple Podcasts",
      },
      {
        feature: "Multi-language",
        briefTube: "Yes — 55 languages",
        competitor: "Not specified",
      },
      {
        feature: "Price",
        briefTube: `Free (${SiteConfig.freeChannelsLimit} channels), Pro unlimited`,
        competitor: "$5.99/month, 10 subscriptions max",
      },
    ],
    verdict:
      "Snipcast has proven the model works—people absolutely want their channels summarized without having to visit YouTube. But there's a real-world difference: text summaries get buried in your email inbox; audio files delivered to Telegram, Discord, or Slack are ready to play immediately on your commute. Plus, Snipcast's 10-channel cap is a genuine constraint if you follow more creators. On Pro, BriefTube has no ceiling.",
    competitorBestFor:
      "Email-focused users who like text summaries and also follow Spotify or Apple Podcasts alongside YouTube",
    briefTubeBestFor:
      "People who want hands-free audio summaries and follow more than 10 YouTube channels without hitting a limit",
  },
  {
    slug: "summarize-tech",
    competitor: "Summarize.tech",
    title:
      "BriefTube vs Summarize.tech: automated audio delivery vs on-demand web summaries",
    description:
      "Summarize.tech is one click away—paste a URL, get a text summary, move forward. BriefTube asks you to add channels upfront, then never asks again. It's a classic trade-off: zero friction now versus zero friction later. If you watch videos occasionally, Summarize.tech wins. If you follow channels regularly, BriefTube compounds its benefit over time.",
    lastUpdated: "2026-03-07",
    competitorDescription:
      "Summarize.tech is beautifully minimal: paste a YouTube URL, get back a chapter-by-chapter text summary. No signup required, super fast. The caveat is it depends on YouTube's auto-generated captions, so videos without subtitles don't get summaries.",
    table: [
      {
        feature: "Automatic monitoring",
        briefTube: "Yes, RSS-based",
        competitor: "No — paste URL manually each time",
      },
      {
        feature: "Audio output",
        briefTube: "Yes, neural TTS",
        competitor: "No — text only",
      },
      {
        feature: "Push delivery",
        briefTube: "Telegram, Discord, Slack, podcast RSS",
        competitor: "No",
      },
      {
        feature: "Works without subtitles",
        briefTube: "Yes — Whisper transcription fallback",
        competitor: "No — subtitle-dependent",
      },
      {
        feature: "Account required",
        briefTube: "Yes",
        competitor: "No for basic use",
      },
      {
        feature: "Channels you can monitor",
        briefTube: "5 free, unlimited on Pro",
        competitor: "None — single video only",
      },
      {
        feature: "Paid plan",
        briefTube: "Pro unlimited channels",
        competitor: "$10/month — 200 videos cap",
      },
    ],
    verdict:
      "Summarize.tech is for the moment—you find a video, paste the URL, get instant text. BriefTube is for the future—set up your channels once, get audio automatically forever. If you're stumbling across videos randomly, Summarize.tech. If you actively follow creators, BriefTube's setup pays dividends immediately.",
    competitorBestFor:
      "Casual browsers who randomly encounter videos and want quick, no-signup text summaries without committing",
    briefTubeBestFor:
      "Channel subscribers who follow specific creators and want audio summaries arriving automatically",
  },
  {
    slug: "kome",
    competitor: "Kome.ai",
    title:
      "BriefTube vs Kome.ai: automated audio summaries vs browser extension bookmarking",
    description:
      "Kome.ai is built into your browser and activates when you find something worth saving. BriefTube runs invisibly in the background and brings your channels to you. One is about capturing ad-hoc discoveries; the other is about staying informed on things you already care about. Different use cases entirely.",
    lastUpdated: "2026-03-07",
    competitorDescription:
      "Kome.ai is a browser extension that lets you bookmark and summarize anything you find online—YouTube videos, articles, web pages. Works across Chrome, Firefox, Edge, and Brave. You click when you want summaries. The paid plan ($5.99/month) gives you 200 summary credits.",
    table: [
      {
        feature: "Automatic channel monitoring",
        briefTube: "Yes",
        competitor: "No — manual per video",
      },
      {
        feature: "Audio output",
        briefTube: "Yes, neural TTS delivered to Telegram, Discord, Slack",
        competitor: "No — text only",
      },
      {
        feature: "Push delivery",
        briefTube: "Yes",
        competitor: "No",
      },
      {
        feature: "Bookmarking and annotation",
        briefTube: "No",
        competitor: "Yes — core feature",
      },
      {
        feature: "Browser extension required",
        briefTube: "No",
        competitor: "Yes",
      },
      {
        feature: "Monthly summary limit",
        briefTube: "No limit on Pro",
        competitor: "200 summaries/month on paid plan",
      },
      {
        feature: "Price",
        briefTube: `Free (${SiteConfig.freeChannelsLimit} channels), Pro unlimited`,
        competitor: "$5.99/month — 200 credits cap",
      },
    ],
    verdict:
      "Kome.ai is for the discovery mindset—you encounter content, you decide it's worth saving, you get a summary. BriefTube is for the subscription mindset—you picked your channels, now get summaries delivered automatically. They're solving different problems. Kome.ai won't monitor your YouTube channels; BriefTube won't help you capture random articles you stumble on.",
    competitorBestFor:
      "Active web users who discover content while browsing and want to bookmark and summarize it on demand",
    briefTubeBestFor:
      "YouTube subscribers who want audio summaries delivered automatically without opening a browser or extension",
  },
];
