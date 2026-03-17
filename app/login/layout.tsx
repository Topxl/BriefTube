import type { Metadata } from "next";
import { SiteConfig } from "@/site-config";

export const metadata: Metadata = {
  title: "Sign in",
  description: `Sign in to ${SiteConfig.title} and start receiving AI-powered audio summaries of your YouTube channels, delivered directly to your Telegram.`,
  robots: { index: true, follow: true },
};

export default async function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
