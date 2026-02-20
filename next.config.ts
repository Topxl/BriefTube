import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    authInterrupts: true,
  },
  cacheComponents: true,
  typedRoutes: true,
  images: {
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
  async redirects() {
    return [
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
      {
        source: "/admin/:path*",
        destination: "/dashboard",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
