import type { Metadata } from "next";
import Link from "next/link";
import { SiteConfig } from "@/site-config";
import { env } from "@/lib/env";
import { Mail, MessageCircle, Zap, Youtube } from "@/lib/icons";

export const metadata: Metadata = {
  title: "Support",
  description:
    "Get help with BriefTube. Find answers to common questions or reach out to our team.",
  alternates: { canonical: `${SiteConfig.prodUrl}/support` },
};

const email = env.NEXT_PUBLIC_EMAIL_CONTACT ?? "contact@brief-tube.com";

const FAQ = [
  {
    q: "How do I connect my Telegram account?",
    a: "Go to your dashboard, open your profile, and follow the Telegram setup instructions. You'll need to message our bot to link your account.",
  },
  {
    q: "How do I add a YouTube channel?",
    a: 'From the dashboard, click "Add channel", paste the channel URL or handle, and confirm. New videos will be detected automatically.',
  },
  {
    q: "How long does it take to receive a summary?",
    a: "Summaries are usually delivered within a few minutes of a new video being published, depending on the current processing queue.",
  },
  {
    q: "Can I change the voice or language?",
    a: "Yes. Go to your profile settings to choose from dozens of neural TTS voices across multiple languages.",
  },
  {
    q: "How do I upgrade to Pro?",
    a: "From your profile, click the Upgrade button and complete the checkout. Pro gives you unlimited channels.",
  },
  {
    q: "How do I cancel my subscription?",
    a: "Go to your profile, scroll to the Subscription section, and click Cancel subscription. Your access continues until the end of the billing period.",
  },
  {
    q: "How do I delete my account?",
    a: "Go to your profile and click Delete account. All your data is permanently removed.",
  },
];

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-2xl px-4">
      {/* Header */}
      <div className="mb-12 flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Support</h1>
        <p className="text-muted-foreground text-sm">
          We&apos;re here to help. Browse common questions or reach out
          directly.
        </p>
      </div>

      <div className="flex flex-col gap-10">
        {/* Contact + Quick links grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Contact */}
          <section className="flex flex-col gap-3">
            <h2 className="text-muted-foreground/60 px-1 text-xs font-medium tracking-wide uppercase">
              Contact
            </h2>
            <a
              href={`mailto:${email}`}
              className="nm-raised flex flex-1 items-center gap-4 rounded-2xl px-5 py-4 transition-opacity hover:opacity-75"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/10">
                <Mail className="h-5 w-5 text-red-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">Email us</p>
                <p className="text-muted-foreground truncate text-xs">
                  {email}
                </p>
              </div>
            </a>
          </section>

          {/* Quick links */}
          <section className="flex flex-col gap-3">
            <h2 className="text-muted-foreground/60 px-1 text-xs font-medium tracking-wide uppercase">
              Quick links
            </h2>
            <div className="nm-raised overflow-hidden rounded-2xl">
              {[
                {
                  icon: <Zap className="h-3.5 w-3.5 text-red-400" />,
                  label: "Upgrade to Pro",
                  href: "/pricing",
                },
                {
                  icon: <MessageCircle className="h-3.5 w-3.5 text-blue-400" />,
                  label: "Connect Telegram",
                  href: "/dashboard/profile",
                },
                {
                  icon: <Youtube className="h-3.5 w-3.5 text-red-400" />,
                  label: "Manage channels",
                  href: "/dashboard",
                },
              ].map(({ icon, label, href }) => (
                <Link
                  key={href}
                  href={href}
                  className="text-muted-foreground hover:text-foreground flex items-center gap-2.5 border-b border-white/[0.04] px-4 py-2.5 text-sm transition-colors last:border-0"
                >
                  {icon}
                  {label}
                  <span className="ml-auto text-xs opacity-40">→</span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        {/* FAQ */}
        <section className="flex flex-col gap-3">
          <h2 className="text-muted-foreground/60 px-1 text-xs font-medium tracking-wide uppercase">
            Common questions
          </h2>
          <div className="nm-raised overflow-hidden rounded-2xl">
            {FAQ.map(({ q, a }, i) => (
              <div
                key={i}
                className="flex flex-col gap-2 border-b border-white/[0.04] px-5 py-4 last:border-0"
              >
                <p className="text-sm font-medium">{q}</p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {a}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer links */}
        <div className="flex items-center gap-4 border-t border-white/[0.04] pt-4">
          <Link
            href="/privacy"
            className="text-muted-foreground hover:text-foreground text-xs transition-colors"
          >
            Privacy Policy
          </Link>
          <Link
            href="/terms"
            className="text-muted-foreground hover:text-foreground text-xs transition-colors"
          >
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
}
