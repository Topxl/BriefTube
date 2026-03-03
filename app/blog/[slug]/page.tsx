import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteConfig } from "@/site-config";
import { articles } from "@/content/blog";
import Link from "next/link";
import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "@/lib/icons";

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
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: article.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.description,
      images: ["/opengraph-image"],
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

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: SiteConfig.prodUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: `${SiteConfig.prodUrl}/blog`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: article.title,
        item: `${SiteConfig.prodUrl}/blog/${article.slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      <div className="bg-background min-h-screen">
        <Navbar />

        <main className="mx-auto max-w-2xl px-6 pt-32 pb-20">
          {/* Back */}
          <Link
            href="/blog"
            className="text-muted-foreground hover:text-foreground mb-10 inline-flex items-center gap-1.5 text-sm transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Blog
          </Link>

          <article className="flex flex-col gap-10">
            {/* Article header */}
            <header className="nm-raised flex flex-col gap-4 rounded-2xl p-6">
              <span className="inline-flex w-fit items-center rounded-full bg-red-500/[0.1] px-2.5 py-0.5 text-[11px] font-medium text-red-400">
                {article.category}
              </span>

              <h1 className="font-display text-2xl leading-snug font-bold md:text-3xl">
                {article.title}
              </h1>

              <p className="text-muted-foreground text-sm leading-relaxed">
                {article.description}
              </p>

              <div className="text-muted-foreground flex items-center gap-3 border-t border-white/[0.05] pt-3 text-xs">
                <span>{article.date}</span>
                <span className="text-white/20">·</span>
                <span>{article.readingTime}</span>
              </div>
            </header>

            {/* Content */}
            <div
              className="prose prose-invert flex max-w-none flex-col gap-6"
              dangerouslySetInnerHTML={{ __html: article.content }}
            />

            {/* CTA */}
            <div className="nm-raised flex flex-col gap-4 rounded-2xl border border-red-500/[0.12] p-6">
              <p className="font-display text-lg font-semibold">
                Sounds useful?
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Try BriefTube free for {SiteConfig.trialDays} days. Get AI audio
                summaries of your favorite YouTube channels delivered to
                Telegram.
              </p>
              <Button
                className="w-fit bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.25)] hover:bg-red-500"
                asChild
              >
                <Link href="/login">Start Free Trial</Link>
              </Button>
            </div>

            {/* Back */}
            <Link
              href="/blog"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Blog
            </Link>
          </article>
        </main>

        <Footer />
      </div>
    </>
  );
}
