import { notFound } from "next/navigation";
import { type Metadata } from "next";
import { landingVariants } from "@/content/landing-variants";
import { LandingVariantPage } from "@/components/lp/landing-variant-page";

type Props = {
  params: Promise<{ variant: string }>;
};

export function generateStaticParams() {
  return landingVariants.map((v) => ({ variant: v.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { variant: slug } = await params;
  const variant = landingVariants.find((v) => v.slug === slug);

  if (!variant) return {};

  return {
    title: variant.pageTitle,
    description: variant.pageDescription,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function LpVariantPage({ params }: Props) {
  const { variant: slug } = await params;
  const variant = landingVariants.find((v) => v.slug === slug);

  if (!variant) {
    notFound();
  }

  return <LandingVariantPage variant={variant} />;
}
