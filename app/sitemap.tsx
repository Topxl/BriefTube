import type { MetadataRoute } from "next";
import { SiteConfig } from "@/site-config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [
    {
      url: `${SiteConfig.prodUrl}`,
      lastModified: new Date("2026-02-24"),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SiteConfig.prodUrl}/login`,
      lastModified: new Date("2026-02-24"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SiteConfig.prodUrl}/privacy`,
      lastModified: new Date("2026-02-18"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SiteConfig.prodUrl}/terms`,
      lastModified: new Date("2026-02-18"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
