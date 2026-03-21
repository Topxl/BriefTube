import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  trailingSlash: false,
  experimental: {
    authInterrupts: true,
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
    optimizePackageImports: [
      "lucide-react",
      "@supabase/supabase-js",
      "date-fns",
      "@tanstack/react-query",
      "motion",
    ],
  },
  cacheComponents: true,
  typedRoutes: true,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7 days
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "img.youtube.com",
      },
      {
        protocol: "https",
        hostname: "i.ytimg.com",
      },
      {
        protocol: "https",
        hostname: "yt3.ggpht.com",
      },
      {
        protocol: "https",
        hostname: "yt3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "ui-avatars.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/demo-thumb-1.webp",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // Redirect non-www → www (canonical domain)
      {
        source: "/:path*",
        has: [{ type: "host", value: "brief-tube.com" }],
        destination: "https://www.brief-tube.com/:path*",
        permanent: true,
      },
      // Duplicate landing page
      {
        source: "/home",
        destination: "/",
        permanent: true,
      },
      {
        source: "/orgs/:path*",
        destination: "/dashboard",
        permanent: true,
      },
      {
        source: "/auth/signin",
        destination: "/login",
        permanent: true,
      },
      {
        source: "/auth/signup",
        destination: "/login",
        permanent: true,
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
