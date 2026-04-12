import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

// withSentryConfig from @sentry/nextjs has been disabled because it
// auto-instruments every server-side page module, transitively pulling in
// @opentelemetry/api + require-in-the-middle which Next.js 16.2 + Turbopack
// rewrites with content-hashed external module names that fail at runtime
// (verified 2026-04-07: privacy page require()'d "require-in-the-middle-<hash>"
// even after instrumentation.ts was emptied). Removing this wrapper keeps
// Sentry client-side via instrumentation-client.ts but drops:
//   - source map upload (do it manually if needed)
//   - tunnelRoute (/monitoring) for ad-blocker bypass
//   - bundleSizeOptimizations
// We accept this until Turbopack lands a fix for external module hash
// resolution in standalone builds.

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

// ---------------------------------------------------------------------------
// Content Security Policy
// ---------------------------------------------------------------------------
// Dev mode needs 'unsafe-eval' because React 19 uses eval() to reconstruct
// callstacks for debug features. This is NEVER allowed in production.
const isDev = process.env.NODE_ENV === "development";
const evalDirective = isDev ? " 'unsafe-eval'" : "";

// Google Ads sends conversion pings and loads remarketing pixels from
// country-specific domains (google.co.th, google.co.uk, google.com.au, etc.)
// based on the user's location. CSP *.google.com does NOT match these ccTLDs.
// We add the target ad markets (USA is google.com, already covered by *.google.com)
// plus the admin's location (Thailand). Add more if ads expand to other regions.
const googleCcTLDs = [
  "https://*.google.co.th", // Thailand (admin)
  "https://*.google.co.uk", // UK (ad target)
  "https://*.google.ca", // Canada (ad target)
  "https://*.google.com.au", // Australia (ad target)
].join(" ");

const cspDirectives = [
  // Default: only allow same-origin
  "default-src 'self'",

  // Scripts: self + GTM/Google Ads + Rewardful + Cloudflare analytics + inline
  [
    `script-src 'self' 'unsafe-inline'${evalDirective}`,
    "https://www.googletagmanager.com",
    "https://googleads.g.doubleclick.net", // Google Ads viewthrough conversion script
    "https://r.wdfl.co",
    "https://us-assets.i.posthog.com",
    "https://static.cloudflareinsights.com", // Cloudflare Web Analytics beacon
  ].join(" "),

  // Styles: unsafe-inline required for Tailwind / CSS-in-JS
  "style-src 'self' 'unsafe-inline'",

  // Workers: PostHog uses blob: workers
  "worker-src 'self' blob:",

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
    "https://www.googletagmanager.com",
    "https://www.google.com",
    "https://*.google.com",
    googleCcTLDs, // Google Ads country-specific remarketing pixels
    "https://googleads.g.doubleclick.net",
    "https://www.googleadservices.com",
  ].join(" "),

  // Media: audio summaries from Cloudflare R2
  "media-src 'self' https://*.r2.dev",

  // Fonts: self only (next/font self-hosts Google Fonts)
  "font-src 'self'",

  // Connect: APIs the browser calls directly
  [
    "connect-src 'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://noembed.com",
    "https://www.youtube.com",
    "https://www.googletagmanager.com",
    "https://www.google-analytics.com",
    "https://r.wdfl.co",
    "https://*.google-analytics.com",
    "https://*.analytics.google.com",
    "https://*.ingest.de.sentry.io",
    "https://www.google.com",
    "https://*.google.com",
    googleCcTLDs, // Google Ads conversion pings to country-specific domains
    "https://googleads.g.doubleclick.net",
    "https://www.googleadservices.com",
    "https://us.i.posthog.com",
    "https://us-assets.i.posthog.com",
  ].join(" "),

  // Frames: YouTube embeds (not used today, but safe to allow)
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://js.stripe.com",

  // Prevent this site from being embedded (clickjacking protection)
  "frame-ancestors 'none'",

  // Forms can submit to same origin + Stripe Checkout (redirect after /api/stripe/checkout)
  "form-action 'self' https://checkout.stripe.com",

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

export default withBundleAnalyzer(nextConfig);
