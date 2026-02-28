import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Simple in-memory rate limiting (per IP, 3 requests per 10 min)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 10 * 60 * 1000;

function getIp(req: NextRequest): string {
  // x-real-ip is set by the infrastructure and can't be spoofed by the client.
  // Fall back to the last entry of x-forwarded-for (added by Vercel's edge).
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ??
    "unknown"
  );
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;
  return false;
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  // Bare video ID
  if (/^[\w-]{11}$/.test(url.trim())) return url.trim();
  return null;
}

async function tryFetchLang(
  videoId: string,
  lang: string,
): Promise<string | null> {
  try {
    const url =
      lang === "auto"
        ? `https://www.youtube.com/api/timedtext?v=${videoId}&fmt=json3&tlang=fr`
        : `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=json3`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      events?: { segs?: { utf8?: string }[] }[];
    };
    const text = (data.events ?? [])
      .flatMap((e) => e.segs ?? [])
      .map((s) => s.utf8 ?? "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    return text.length > 100 ? text : null;
  } catch {
    return null;
  }
}

async function fetchTranscript(videoId: string): Promise<string | null> {
  const fr = await tryFetchLang(videoId, "fr");
  if (fr) return fr;
  const en = await tryFetchLang(videoId, "en");
  if (en) return en;
  return tryFetchLang(videoId, "auto");
}

async function fetchVideoInfo(
  videoId: string,
): Promise<{ title: string; channel: string } | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      title?: string;
      author_name?: string;
    };
    return {
      title: data.title ?? videoId,
      channel: data.author_name ?? "Unknown",
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a few minutes and try again." },
      { status: 429 },
    );
  }

  const body = (await req.json()) as { url?: string };
  const url = body.url?.trim() ?? "";

  if (!url) {
    return NextResponse.json({ error: "Missing URL" }, { status: 400 });
  }

  const videoId = extractVideoId(url);
  if (!videoId) {
    return NextResponse.json(
      {
        error:
          "Invalid YouTube URL. Try: youtube.com/watch?v=... or youtu.be/...",
      },
      { status: 400 },
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Demo temporarily unavailable. Please try again later." },
      { status: 503 },
    );
  }

  // Fetch video info and transcript in parallel
  const [videoInfo, transcript] = await Promise.all([
    fetchVideoInfo(videoId),
    fetchTranscript(videoId),
  ]);

  if (!transcript) {
    return NextResponse.json(
      {
        error:
          "No subtitles found for this video. Try a video with captions enabled.",
      },
      { status: 422 },
    );
  }

  // Summarize with Gemini
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `You are an assistant that summarizes YouTube videos concisely and engagingly.

Here is the transcript of a YouTube video titled "${videoInfo?.title ?? ""}".
Write a 3-to-5 sentence summary in English that captures the key points.
Be direct, skip any intro phrase like "In this video...", and keep it easy to read.

Transcript:
${transcript.slice(0, 8000)}`;

    const result = await model.generateContent(prompt);
    const summary = result.response.text().trim();

    return NextResponse.json({
      videoId,
      title: videoInfo?.title ?? videoId,
      channel: videoInfo?.channel ?? "Unknown",
      summary,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate summary. Please try again." },
      { status: 500 },
    );
  }
}
