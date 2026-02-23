import Link from "next/link";
import type { Metadata } from "next";
import { SiteConfig } from "@/site-config";
import { comparisons } from "@/content/comparisons";
import { Typography } from "@/components/nowts/typography";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "BriefTube Comparisons",
  description:
    "See how BriefTube compares to other YouTube summarizer tools like Eightify and NoteGPT.",
  alternates: { canonical: `${SiteConfig.prodUrl}/vs` },
};

export default function ComparisonsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground text-sm transition-colors"
        >
          ← Back to Home
        </Link>
      </div>

      <Typography variant="h1" className="mb-2">
        BriefTube Comparisons
      </Typography>
      <Typography variant="p" className="text-muted-foreground mb-12">
        See how BriefTube compares to other YouTube summarizer and monitoring
        tools.
      </Typography>

      <div className="flex flex-col gap-4">
        {comparisons.map((comparison) => (
          <Link
            key={comparison.slug}
            href={`/vs/${comparison.slug}`}
            className="group rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 transition-all hover:border-white/[0.12] hover:bg-white/[0.05]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Typography
                  variant="h3"
                  className="mb-2 transition-colors group-hover:text-red-400"
                >
                  BriefTube vs {comparison.competitor}
                </Typography>
                <Typography
                  variant="p"
                  className="text-muted-foreground text-sm"
                >
                  {comparison.description}
                </Typography>
              </div>
              <Button variant="outline" size="sm" className="shrink-0" asChild>
                <span>Read comparison</span>
              </Button>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
