import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteConfig } from "@/site-config";
import { comparisons } from "@/content/comparisons";
import { Typography } from "@/components/nowts/typography";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";

type PageProps = {
  params: Promise<{ competitor: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { competitor } = await params;
  const data = comparisons.find((c) => c.slug === competitor);

  if (!data) {
    return {};
  }

  return {
    title: data.title,
    description: data.description,
    alternates: { canonical: `${SiteConfig.prodUrl}/vs/${competitor}` },
  };
}

export async function generateStaticParams() {
  return comparisons.map((comparison) => ({
    competitor: comparison.slug,
  }));
}

export default async function ComparisonPage({ params }: PageProps) {
  const { competitor } = await params;
  const data = comparisons.find((c) => c.slug === competitor);

  if (!data) {
    notFound();
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: data.title,
    description: data.description,
    image: `${SiteConfig.prodUrl}/opengraph-image`,
    datePublished: new Date(data.lastUpdated).toISOString(),
    dateModified: new Date(data.lastUpdated).toISOString(),
    url: `${SiteConfig.prodUrl}/vs/${competitor}`,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SiteConfig.prodUrl}/vs/${competitor}`,
    },
    author: {
      "@type": "Organization",
      name: "BriefTube",
    },
    publisher: {
      "@type": "Organization",
      name: "BriefTube",
      url: SiteConfig.prodUrl,
      logo: {
        "@type": "ImageObject",
        url: `${SiteConfig.prodUrl}/logo-120.png`,
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
        name: "Comparisons",
        item: `${SiteConfig.prodUrl}/vs`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: data.title,
        item: `${SiteConfig.prodUrl}/vs/${competitor}`,
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

        <div className="mx-auto max-w-3xl px-4 pt-32 pb-20">
          <Typography variant="h1" className="mb-4">
            {data.title}
          </Typography>
          <p className="text-muted-foreground mb-12 text-sm">
            Last updated: {data.lastUpdated}
          </p>

          <div className="flex flex-col gap-12">
            <section className="flex flex-col gap-4">
              <Typography variant="h2">About {data.competitor}</Typography>
              <Typography variant="p">{data.competitorDescription}</Typography>
            </section>

            <section className="flex flex-col gap-4">
              <Typography variant="h2">Feature Comparison</Typography>
              <div className="overflow-x-auto rounded-lg border border-white/[0.08]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.08] bg-white/[0.03]">
                      <th className="text-foreground px-4 py-3 text-left font-semibold">
                        Feature
                      </th>
                      <th className="text-foreground px-4 py-3 text-left font-semibold">
                        BriefTube
                      </th>
                      <th className="text-foreground px-4 py-3 text-left font-semibold">
                        {data.competitor}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.table.map((row, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-white/[0.08] last:border-b-0"
                      >
                        <td className="text-foreground px-4 py-3 font-medium">
                          {row.feature}
                        </td>
                        <td className="text-foreground px-4 py-3">
                          {row.briefTube}
                        </td>
                        <td className="text-muted-foreground px-4 py-3">
                          {row.competitor}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="flex flex-col gap-4 rounded-xl border border-white/[0.08] bg-white/[0.03] p-6">
              <Typography variant="h2">Verdict</Typography>
              <Typography variant="p">{data.verdict}</Typography>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
                <Typography variant="h3" className="mb-2">
                  {data.competitor} is best for
                </Typography>
                <Typography variant="p" className="text-muted-foreground">
                  {data.competitorBestFor}
                </Typography>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
                <Typography variant="h3" className="mb-2">
                  BriefTube is best for
                </Typography>
                <Typography variant="p" className="text-muted-foreground">
                  {data.briefTubeBestFor}
                </Typography>
              </div>
            </section>

            <section className="flex flex-col gap-4 rounded-xl border border-white/[0.08] bg-red-600/10 p-6">
              <Typography variant="h2">Ready to try BriefTube?</Typography>
              <Typography variant="p">
                {`Get started free with ${SiteConfig.freeChannelsLimit} channels, or try Pro for ${SiteConfig.trialDays} days to unlock unlimited channels and never miss an update.`}
              </Typography>
              <div>
                <Link href="/login">
                  <Button size="lg">{`Sign up free, ${SiteConfig.trialDays}-day Pro trial`}</Button>
                </Link>
              </div>
            </section>
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
}
