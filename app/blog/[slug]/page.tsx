import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteConfig } from "@/site-config";
import { articles } from "@/content/blog";
import Link from "next/link";
import { Typography } from "@/components/nowts/typography";
import { Button } from "@/components/ui/button";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = articles.find((a) => a.slug === slug);

  if (!article) {
    return {};
  }

  return {
    title: article.title,
    description: article.description,
    alternates: {
      canonical: `${SiteConfig.prodUrl}/blog/${article.slug}`,
    },
    openGraph: {
      type: "article",
      publishedTime: article.date,
      title: article.title,
      description: article.description,
      url: `${SiteConfig.prodUrl}/blog/${article.slug}`,
    },
  };
}

export async function generateStaticParams() {
  return articles.map((article) => ({
    slug: article.slug,
  }));
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = articles.find((a) => a.slug === slug);

  if (!article) {
    notFound();
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    datePublished: article.date,
    author: {
      "@type": "Organization",
      name: "BriefTube",
    },
    publisher: {
      "@type": "Organization",
      name: "BriefTube",
      logo: {
        "@type": "ImageObject",
        url: `${SiteConfig.prodUrl}${SiteConfig.appIcon}`,
      },
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

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
          <div className="mb-8">
            <Link
              href="/blog"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              ← Back to Blog
            </Link>
          </div>

          <article className="mx-auto max-w-2xl">
            <header className="mb-8 flex flex-col gap-4">
              <Typography variant="h1">{article.title}</Typography>

              <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-sm">
                <span>{article.date}</span>
                <span>•</span>
                <span>{article.readingTime}</span>
                <span>•</span>
                <span className="inline-block rounded-full bg-white/[0.08] px-2.5 py-1 text-xs font-medium">
                  {article.category}
                </span>
              </div>
            </header>

            <div
              className="prose prose-invert flex max-w-none flex-col gap-6"
              dangerouslySetInnerHTML={{ __html: article.content }}
            />

            <div className="mt-12 flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
              <Typography variant="h3">Sounds useful?</Typography>
              <Typography variant="muted">
                Try BriefTube free for 7 days. Get AI audio summaries of your
                favorite YouTube channels delivered to Telegram.
              </Typography>
              <Link href="/login" className="w-fit">
                <Button className="bg-red-600 hover:bg-red-700">
                  Start Free Trial
                </Button>
              </Link>
            </div>

            <div className="mt-8">
              <Link
                href="/blog"
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                ← Back to Blog
              </Link>
            </div>
          </article>
        </main>
      </div>
    </>
  );
}
