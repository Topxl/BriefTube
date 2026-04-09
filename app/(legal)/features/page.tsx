import type { Metadata } from "next";
import { SiteConfig } from "@/site-config";
import { FeatureRoadmap } from "@/features/feature-roadmap/feature-roadmap";

export const metadata: Metadata = {
  title: "Roadmap & Feature Requests",
  description:
    "Discover features requested by the BriefTube community. Vote for the ones you like or suggest your own.",
  alternates: { canonical: `${SiteConfig.prodUrl}/features` },
};

export default function FeaturesPage() {
  return (
    <div className="mx-auto max-w-2xl px-4">
      {/* Header */}
      <div className="mb-12 flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Roadmap</h1>
        <p className="text-muted-foreground text-sm">
          Features requested by the BriefTube community. Vote for the ones you
          like. The most popular get built first.
        </p>
      </div>

      <FeatureRoadmap />
    </div>
  );
}
