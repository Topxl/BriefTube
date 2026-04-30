import type { Metadata } from "next";
import { SiteConfig } from "@/site-config";
import { articles } from "@/content/blog";
import Link from "next/link";
import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Guides and thoughts on consuming YouTube smarter: productivity, AI tools, and learning efficiently.",
  alternates: { canonical: `${SiteConfig.prodUrl}/blog` },
};

export default function BlogPage() {
  const blogJsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "BriefTube Blog",
    description:
      "Guides on YouTube summarization, productivity, and AI tools for staying on top of channel feeds.",
    url: `${SiteConfig.prodUrl}/blog`,
    publisher: {
      "@type": "Organization",
      name: "BriefTube",
      url: SiteConfig.prodUrl,
    },
    blogPost: articles.map((article) => ({
      "@type": "BlogPosting",
      headline: article.title,
      url: `${SiteConfig.prodUrl}/blog/${article.slug}`,
      datePublished: new Date(article.date).toISOString(),
      image: `${SiteConfig.prodUrl}/opengraph-image`,
      author: {
        "@type": "Person",
        name: "Vin",
      },
    })),
  };

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: articles.map((article, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${SiteConfig.prodUrl}/blog/${article.slug}`,
    })),
  };

  return (
    <div className="bg-background min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <Navbar />

      <main className="mx-auto max-w-6xl px-6 pt-32 pb-20">
        {/* Header */}
        <div className="mb-14 flex flex-col gap-3">
          <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
            Blog
          </p>
          <h1 className="font-display text-3xl font-bold md:text-4xl">
            Guides &amp; insights
          </h1>
          <p className="text-muted-foreground mt-1 max-w-xl text-base leading-relaxed">
            Thoughts on consuming YouTube smarter, productivity, and AI tools.
          </p>
        </div>

        {/* Grid */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <Link
              key={article.slug}
              href={`/blog/${article.slug}`}
              className="nm-raised group flex flex-col gap-4 rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1"
            >
              {/* Category */}
              <span className="inline-flex w-fit items-center rounded-full bg-red-500/[0.1] px-2.5 py-0.5 text-[11px] font-medium text-red-400">
                {article.category}
              </span>

              {/* Title */}
              <h2 className="font-display line-clamp-2 text-base leading-snug font-semibold">
                {article.title}
              </h2>

              {/* Description */}
              <p className="text-muted-foreground line-clamp-2 flex-1 text-sm leading-relaxed">
                {article.description}
              </p>

              {/* Meta */}
              <div className="text-muted-foreground flex items-center justify-between border-t border-white/[0.05] pt-3 text-xs">
                <span>{article.date}</span>
                <span>{article.readingTime}</span>
              </div>
            </Link>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
