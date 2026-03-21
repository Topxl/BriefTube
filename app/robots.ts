import type { MetadataRoute } from "next";
import { SiteConfig } from "@/site-config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "GPTBot",
        allow: "/",
        disallow: ["/dashboard/", "/api/", "/auth/", "/onboarding/"],
      },
      {
        userAgent: "OAI-SearchBot",
        allow: "/",
        disallow: ["/dashboard/", "/api/", "/auth/", "/onboarding/"],
      },
      {
        userAgent: "PerplexityBot",
        allow: "/",
        disallow: ["/dashboard/", "/api/", "/auth/", "/onboarding/"],
      },
      {
        userAgent: "Google-Extended",
        allow: "/",
        disallow: ["/dashboard/", "/api/", "/auth/", "/onboarding/"],
      },
      {
        userAgent: "ClaudeBot",
        allow: "/",
        disallow: ["/dashboard/", "/api/", "/auth/", "/onboarding/"],
      },
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard/", "/api/", "/auth/", "/onboarding/"],
      },
    ],
    sitemap: `${SiteConfig.prodUrl}/sitemap.xml`,
  };
}
