import Script from "next/script";
import { NextTopLoader } from "@/features/page/next-top-loader";
import { ServerToaster } from "@/features/server-sonner/server-toaster";
import { LeaChatWidgetLoader } from "@/features/lea-chat/lea-chat-widget-loader";
import { cn } from "@/lib/utils";
import { SiteConfig } from "@/site-config";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Suspense } from "react";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: {
    default: SiteConfig.title,
    template: `%s | ${SiteConfig.title}`,
  },
  description: SiteConfig.description,
  metadataBase: new URL(SiteConfig.prodUrl),
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: SiteConfig.title,
    description: SiteConfig.description,
    url: SiteConfig.prodUrl,
    siteName: SiteConfig.title,
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: SiteConfig.title,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SiteConfig.title,
    description: SiteConfig.description,
    images: ["/opengraph-image"],
    site: "@brieftube",
  },
};

const GeistSans = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "optional",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link
          rel="preconnect"
          href="https://pub-56ac81959a8e42beae1539d791297d90.r2.dev"
          crossOrigin="anonymous"
        />
        <link rel="dns-prefetch" href="https://noembed.com" />
        <link rel="dns-prefetch" href="https://r.wdfl.co" />
        {/* gtag is only used to fire conversion events on signup/checkout
            actions, not on pageview, so lazyOnload keeps it off the critical
            path of every visit. */}
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-NSS12KB41V"
          strategy="lazyOnload"
        />
        <Script id="gtag-config" strategy="lazyOnload">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-NSS12KB41V');
            gtag('config', 'AW-17972477350');
          `}
        </Script>
      </head>
      <body
        suppressHydrationWarning
        className={cn(
          "bg-background h-full font-sans antialiased",
          GeistSans.variable,
        )}
      >
        <NuqsAdapter>
          <Providers>
            <NextTopLoader delay={100} showSpinner={false} />
            <Suspense fallback={null}>{children}</Suspense>
            <Suspense>
              <ServerToaster />
            </Suspense>
            <LeaChatWidgetLoader />
          </Providers>
        </NuqsAdapter>
        {/* Rewardful only fires on signup/checkout flows. lazyOnload keeps
            ~20 KiB off the critical path without breaking attribution. */}
        <Script id="rewardful-queue" strategy="lazyOnload">
          {`(function(w,r){w._rwq=r;w[r]=w[r]||function(){(w[r].q=w[r].q||[]).push(arguments)}})(window,'rewardful');`}
        </Script>
        <Script
          src="https://r.wdfl.co/rw.js"
          data-rewardful="18d746"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}
