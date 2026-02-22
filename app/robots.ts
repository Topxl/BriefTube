import type { MetadataRoute } from "next";
import { SiteConfig } from "@/site-config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SiteConfig.prodUrl}/sitemap.xml`,
  };
}
