import Link from "next/link";
import type { Metadata } from "next";
import { SiteConfig } from "@/site-config";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Read the BriefTube Privacy Policy. Learn how we collect, use, and protect your data when you use our AI-powered YouTube summary and Telegram delivery service.",
  alternates: { canonical: `${SiteConfig.prodUrl}/privacy` },
};

export default function PrivacyPage() {
  return (
    <div className="container max-w-3xl py-12">
      <div className="mb-8">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground text-sm transition-colors"
        >
          ← Back to Home
        </Link>
      </div>

      <h1 className="mb-2 text-3xl font-bold">Privacy Policy</h1>
      <p className="text-muted-foreground mb-10 text-sm">
        Last updated: February 18, 2026
      </p>

      <div className="flex flex-col gap-10">
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">1. Who We Are</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            BriefTube (&quot;we&quot;, &quot;our&quot;, &quot;the Service&quot;)
            is a platform that monitors YouTube channels, generates AI-powered
            audio summaries, and delivers them to your Telegram account. This
            policy explains how we collect, use, and protect your personal data.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">2. Data We Collect</h2>
          <ul className="text-muted-foreground flex flex-col gap-2 text-sm leading-relaxed">
            <li>
              <strong className="text-foreground">Google account data:</strong>{" "}
              Email address and profile name, collected when you sign in with
              Google.
            </li>
            <li>
              <strong className="text-foreground">
                YouTube subscriptions:
              </strong>{" "}
              The list of your YouTube channel subscriptions (channel ID, name,
              thumbnail), collected only when you explicitly click &quot;Import
              from YouTube&quot;. We do not access your watch history, likes,
              comments, or any other YouTube data.
            </li>
            <li>
              <strong className="text-foreground">Telegram chat ID:</strong>{" "}
              Your Telegram identifier, used solely to deliver audio summaries
              to you.
            </li>
            <li>
              <strong className="text-foreground">Payment data:</strong>{" "}
              Processed securely by Stripe. We never store your credit card
              details.
            </li>
            <li>
              <strong className="text-foreground">Usage preferences:</strong>{" "}
              Language and TTS voice settings stored in your profile.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">3. How We Use Your Data</h2>
          <ul className="text-muted-foreground flex flex-col gap-2 text-sm leading-relaxed">
            <li>Authenticate your account via Google OAuth</li>
            <li>
              Monitor YouTube channels you have subscribed to in BriefTube
            </li>
            <li>Generate AI-powered summaries of new videos</li>
            <li>Convert summaries to audio and deliver them via Telegram</li>
            <li>Process payments and manage your subscription plan</li>
            <li>Send transactional notifications about your account</li>
          </ul>
          <p className="text-muted-foreground text-sm leading-relaxed">
            We do not use your data for advertising, profiling, or any purpose
            beyond providing the Service.
          </p>
        </section>

        {/* Required section for YouTube API Services verification */}
        <section className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
          <h2 className="text-xl font-semibold">4. YouTube API Services</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            BriefTube uses the{" "}
            <strong className="text-foreground">YouTube Data API v3</strong> to
            allow you to import your YouTube subscriptions. By using this
            feature, you also agree to the{" "}
            <a
              href="https://www.youtube.com/t/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-400 underline hover:text-red-300"
            >
              YouTube Terms of Service
            </a>
            , the{" "}
            <a
              href="https://www.youtube.com/t/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-400 underline hover:text-red-300"
            >
              YouTube API Services Privacy Policy
            </a>
            , and the{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-400 underline hover:text-red-300"
            >
              Google Privacy Policy
            </a>
            .
          </p>
          <ul className="text-muted-foreground flex flex-col gap-2 text-sm leading-relaxed">
            <li>
              <strong className="text-foreground">Scope used:</strong>{" "}
              <code className="rounded bg-white/[0.06] px-1 py-0.5 text-xs">
                youtube.readonly
              </code>{" "}
              — read-only access to your subscriptions list only.
            </li>
            <li>
              <strong className="text-foreground">What we access:</strong> Only
              the list of channels you are subscribed to on YouTube (channel ID,
              name, thumbnail). We never access your watch history, comments,
              likes, private playlists, or any other content.
            </li>
            <li>
              <strong className="text-foreground">Data storage:</strong> We
              store only the channel ID, name, and thumbnail URL in our
              database. We do not cache or store your Google access token.
            </li>
            <li>
              <strong className="text-foreground">Revoke access:</strong> You
              can revoke BriefTube&apos;s access to your Google account at any
              time via{" "}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-red-400 underline hover:text-red-300"
              >
                Google Account Permissions
              </a>
              .
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">5. Data Sharing</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            We do not sell your personal data. We share it only with the
            following third-party services, strictly necessary to operate
            BriefTube:
          </p>
          <ul className="text-muted-foreground flex flex-col gap-2 text-sm leading-relaxed">
            <li>
              <strong className="text-foreground">Supabase</strong> — database
              and authentication hosting
            </li>
            <li>
              <strong className="text-foreground">Stripe</strong> — payment
              processing
            </li>
            <li>
              <strong className="text-foreground">Telegram</strong> — delivery
              of audio summaries
            </li>
            <li>
              <strong className="text-foreground">Google</strong> — OAuth
              authentication and YouTube API
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">6. Data Retention</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            We retain your data for as long as your account is active. If you
            delete your account, your personal data is deleted within 30 days,
            except for billing records required by law (up to 7 years).
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">7. Your Rights (GDPR)</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            If you are located in the European Economic Area, you have the
            following rights:
          </p>
          <ul className="text-muted-foreground flex flex-col gap-2 text-sm leading-relaxed">
            <li>Right to access your personal data</li>
            <li>Right to rectify inaccurate data</li>
            <li>Right to erasure (&quot;right to be forgotten&quot;)</li>
            <li>Right to data portability</li>
            <li>Right to object to processing</li>
          </ul>
          <p className="text-muted-foreground text-sm leading-relaxed">
            To exercise these rights, contact us at{" "}
            <a
              href="mailto:contact@brief-tube.com"
              className="text-red-400 underline hover:text-red-300"
            >
              contact@brief-tube.com
            </a>
            .
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">8. Security</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            All data is encrypted in transit (HTTPS) and at rest. Access tokens
            are never stored. Authentication is handled by Supabase with
            industry-standard security practices.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">9. Cookies</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            We use only essential cookies for session management and OAuth
            security (CSRF state). We do not use advertising or tracking
            cookies.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">10. Changes to This Policy</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            We may update this policy from time to time. Significant changes
            will be communicated via email or a notice in the app. Continued use
            of BriefTube after changes constitutes acceptance of the new policy.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">11. Contact</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            For any questions about this Privacy Policy:
          </p>
          <p className="text-sm">
            <a
              href="mailto:contact@brief-tube.com"
              className="text-red-400 underline hover:text-red-300"
            >
              contact@brief-tube.com
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
