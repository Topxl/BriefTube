import type { Metadata } from "next";
import { SiteConfig } from "@/site-config";
import { articles } from "@/content/blog";
import Link from "next/link";
import { Typography } from "@/components/nowts/typography";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Guides and thoughts on consuming YouTube smarter — productivity, AI tools, and learning efficiently.",
  alternates: { canonical: `${SiteConfig.prodUrl}/blog` },
};

export default function BlogPage() {
  return (
    <div className="bg-background min-h-screen">
      <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 border-b border-white/[0.08] backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="text-lg font-semibold">
            {SiteConfig.title}
          </Link>
          <Link
            href="/login"
            className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="container py-12">
        <div className="mb-12 flex flex-col gap-4">
          <Typography variant="h1">Blog</Typography>
          <Typography variant="lead" className="text-muted-foreground">
            Guides and thoughts on consuming YouTube smarter — productivity, AI
            tools, and learning efficiently.
          </Typography>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <Link key={article.slug} href={`/blog/${article.slug}`}>
              <div className="group flex h-full flex-col gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 transition-all hover:border-white/[0.12] hover:bg-white/[0.05]">
                <div className="flex items-start justify-between gap-2">
                  <Typography variant="h3" className="line-clamp-2 text-lg">
                    {article.title}
                  </Typography>
                </div>

                <Typography variant="muted" className="line-clamp-2 flex-1">
                  {article.description}
                </Typography>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground inline-block rounded-full bg-white/[0.08] px-2.5 py-1 text-xs font-medium">
                    {article.category}
                  </span>
                </div>

                <div className="text-muted-foreground flex items-center justify-between pt-2 text-xs">
                  <span>{article.date}</span>
                  <span>{article.readingTime}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
