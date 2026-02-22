import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Typography } from "@/components/nowts/typography";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-10">
      {/* Header: thumbnail + title */}
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
            className="h-[90px] w-[120px] rounded-md object-cover"
          />
        </a>
        <div className="flex flex-col gap-1">
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
        <div className="flex flex-wrap gap-2">
          {availableLanguages.map((lang) => (
            <Link
              key={lang}
              href={`/s/${shortId}?lang=${lang}`}
              className={
                lang === currentLanguage
                  ? "bg-primary text-primary-foreground rounded-full px-3 py-1 text-sm font-medium"
                  : "hover:bg-accent rounded-full border px-3 py-1 text-sm font-medium"
              }
            >
              {lang.toUpperCase()}
            </Link>
          ))}
        </div>
      )}

      <hr />

      {/* Summary text */}
      <div className="leading-7 whitespace-pre-line">
        <Typography variant="p">{summary}</Typography>
      </div>

      <hr />

      {/* Audio player */}
      <div className="flex flex-col gap-2">
        <Typography variant="small">Listen to audio summary</Typography>
        <audio controls src={audioUrl} className="w-full" />
      </div>

      <hr />

      {/* CTA */}
      <Card className="flex flex-col items-center gap-4 p-6 text-center">
        <Typography variant="large">
          Get summaries for YOUR channels, delivered to Telegram
        </Typography>
        <Typography variant="muted">
          BriefTube monitors your YouTube channels, generates AI-powered
          summaries, and delivers audio to your Telegram — fully automated.
        </Typography>
        <Button asChild size="lg">
          <Link href="/login">Start free trial</Link>
        </Button>
      </Card>
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
      <Button asChild size="lg">
        <Link href={loginUrl}>
          Create your BriefTube account to access unlimited summaries
        </Link>
      </Button>
    </div>
  );
}
