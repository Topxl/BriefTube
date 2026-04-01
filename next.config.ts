import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

// ---------------------------------------------------------------------------
// Content Security Policy
// ---------------------------------------------------------------------------
const cspDirectives = [
  // Default: only allow same-origin
  "default-src 'self'",

  // Scripts: self + GTM/Google Ads + Rewardful + inline scripts for gtag init
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://r.wdfl.co",

  // Styles: unsafe-inline required for Tailwind / CSS-in-JS
  "style-src 'self' 'unsafe-inline'",

  // Images: all remote patterns from next.config + data:/blob: for Next.js Image
  [
    "img-src 'self' data: blob:",
    "https://img.youtube.com",
    "https://i.ytimg.com",
    "https://yt3.ggpht.com",
    "https://yt3.googleusercontent.com",
    "https://lh3.googleusercontent.com",
    "https://ui-avatars.com",
    "https://images.unsplash.com",
    "https://www.googletagmanager.com", // GTM tracking pixel
  ].join(" "),

  // Media: audio summaries from Supabase Storage
  "media-src 'self' https://*.supabase.co",

  // Fonts: self only (next/font self-hosts Google Fonts)
  "font-src 'self'",

  // Connect: APIs the browser calls directly
  [
    "connect-src 'self'",
    "https://*.supabase.co", // Supabase auth + DB
    "wss://*.supabase.co", // Supabase Realtime WebSocket
    "https://noembed.com", // Video title resolution
    "https://www.youtube.com", // oembed API
    "https://www.googletagmanager.com", // GTM beacons
    "https://www.google-analytics.com", // GA4 events
    "https://r.wdfl.co", // Rewardful
    "https://*.google-analytics.com", // GA4 measurement
    "https://*.analytics.google.com", // GA4
    "https://*.ingest.de.sentry.io", // Sentry error tracking
  ].join(" "),

  // Frames: YouTube embeds (not used today, but safe to allow)
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://js.stripe.com",

  // Prevent this site from being embedded (clickjacking protection)
  "frame-ancestors 'none'",

  // Forms can only submit to same origin
  "form-action 'self'",

  // Base URI restriction
  "base-uri 'self'",

  // Block <object>, <embed>, <applet>
  "object-src 'none'",
];

const ContentSecurityPolicy = cspDirectives.join("; ");

// ---------------------------------------------------------------------------
// Security headers applied to all routes
// ---------------------------------------------------------------------------
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: ContentSecurityPolicy,
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  trailingSlash: false,
  skipTrailingSlashRedirect: true,
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
      "posthog-js",
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
      // Security headers on all routes
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      // Long-term cache for static demo asset
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
  async rewrites() {
    return [
      {
        source: "/a/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/a/:path*",
        destination: "https://us.i.posthog.com/:path*",
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
      // Common browser/crawler requests → existing routes
      {
        source: "/apple-touch-icon.png",
        destination: "/apple-icon.png",
        permanent: true,
      },
      {
        source: "/apple-touch-icon-precomposed.png",
        destination: "/apple-icon.png",
        permanent: true,
      },
      {
        source: "/manifest.json",
        destination: "/manifest.webmanifest",
        permanent: true,
      },
    ];
  },
};

export default withSentryConfig(withBundleAnalyzer(nextConfig), {
  org: "vjfpl",
  project: "javascript-nextjs",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeReplayIframe: true,
    excludeReplayShadowDom: true,
  },
});
