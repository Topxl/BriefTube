import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Typography } from "@/components/nowts/typography";
import { Button } from "@/components/ui/button";
import { ShareAudioPlayer } from "@/components/share/share-audio-player";

type SharedSummaryViewProps = {
  videoId: string;
  videoTitle: string;
  summary: string;
  audioUrl: string;
  currentLanguage: string;
  availableLanguages: string[];
  shortId: string;
};

export function SharedSummaryView({
  videoId,
  videoTitle,
  summary,
  audioUrl,
  currentLanguage,
  availableLanguages,
  shortId,
}: SharedSummaryViewProps) {
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  const youtubeUrl = `https://youtu.be/${videoId}`;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-8">
      {/* Header: thumbnail + title */}
      <div className="nm-raised overflow-hidden rounded-2xl p-4">
        <div className="flex items-start gap-4">
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0"
          >
            <img
              src={thumbnailUrl}
              alt={videoTitle}
              width={120}
              height={90}
              className="h-[90px] w-[120px] rounded-xl object-cover"
            />
          </a>
          <div className="flex min-w-0 flex-col gap-1">
            <a
              href={youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-1"
            >
              <Typography variant="h3" className="group-hover:underline">
                {videoTitle}
              </Typography>
              <ExternalLink className="text-muted-foreground mt-1 h-4 w-4 shrink-0" />
            </a>
            <Typography variant="muted">AI Summary</Typography>
          </div>
        </div>

        {/* Language picker */}
        {availableLanguages.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-white/[0.04] pt-3">
            {availableLanguages.map((lang) => (
              <Link
                key={lang}
                href={`/s/${shortId}?lang=${lang}`}
                className={
                  lang === currentLanguage
                    ? "nm-inset rounded-full px-3 py-1 text-xs font-medium text-red-400"
                    : "nm-raised-sm text-muted-foreground hover:text-foreground rounded-full px-3 py-1 text-xs font-medium"
                }
              >
                {lang.toUpperCase()}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Audio player */}
      <div className="nm-raised overflow-hidden rounded-2xl px-5 py-4">
        <p className="text-muted-foreground/50 mb-3 text-xs font-medium tracking-wide uppercase">
          Audio
        </p>
        <ShareAudioPlayer src={audioUrl} />
      </div>

      {/* Summary text */}
      <div className="nm-raised overflow-hidden rounded-2xl px-5 py-4">
        <p className="text-muted-foreground/50 mb-3 text-xs font-medium tracking-wide uppercase">
          Summary
        </p>
        <div className="leading-7 whitespace-pre-line">
          <Typography variant="p">{summary}</Typography>
        </div>
      </div>

      {/* CTA */}
      <div className="nm-raised overflow-hidden rounded-2xl p-6 text-center">
        <p className="text-base font-semibold">
          Get summaries for YOUR channels, delivered to Telegram
        </p>
        <p className="text-muted-foreground mt-2 text-sm">
          BriefTube monitors your YouTube channels, generates AI-powered
          summaries, and delivers audio to your Telegram — fully automated.
        </p>
        <Button
          asChild
          size="lg"
          className="mt-5 rounded-full bg-red-600 hover:bg-red-500"
        >
          <Link href="/login">Start free trial</Link>
        </Button>
      </div>
    </div>
  );
}

type ExpiredViewProps = {
  loginUrl: string;
};

export function ExpiredSummaryView({ loginUrl }: ExpiredViewProps) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 px-4 py-20 text-center">
      <Typography variant="h2">This preview has reached its limit</Typography>
      <Typography variant="muted">
        This shared summary has been viewed too many times or has expired.
      </Typography>
      <Button
        asChild
        size="lg"
        className="rounded-full bg-red-600 hover:bg-red-500"
      >
        <Link href={loginUrl}>
          Create your BriefTube account to access unlimited summaries
        </Link>
      </Button>
    </div>
  );
}
