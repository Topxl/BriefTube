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
    <div className="mx-auto max-w-3xl px-4">
      <div className="mb-12 flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Privacy Policy</h1>
        <p className="text-muted-foreground text-sm">
          Last updated: April 23, 2026
        </p>
      </div>

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
              , read-only access to your subscriptions list only.
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
              <strong className="text-foreground">Supabase</strong>: database
              and authentication hosting
            </li>
            <li>
              <strong className="text-foreground">Stripe</strong>: payment
              processing
            </li>
            <li>
              <strong className="text-foreground">Telegram</strong>: delivery of
              audio summaries
            </li>
            <li>
              <strong className="text-foreground">Google</strong>: OAuth
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

        {/* Required section for Chrome Web Store data-handling disclosure */}
        <section className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
          <h2 className="text-xl font-semibold">
            11. Chrome Extension Data Handling
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            The BriefTube browser extension activates only on YouTube watch
            pages (
            <code className="rounded bg-white/[0.06] px-1 py-0.5 text-xs">
              youtube.com/watch
            </code>
            ) to generate on-demand AI summaries of the current video. This
            section describes every piece of data the extension handles.
          </p>

          <h3 className="text-foreground pt-2 text-base font-semibold">
            What the extension collects and sends
          </h3>
          <ul className="text-muted-foreground flex flex-col gap-2 text-sm leading-relaxed">
            <li>
              <strong className="text-foreground">
                YouTube video ID and transcript:
              </strong>{" "}
              When you request a summary, the extension reads the public
              transcript of the YouTube video you are watching and sends it,
              along with the video ID, title, channel ID and video duration, to
              our backend for AI summarization. No transcript is captured unless
              you explicitly trigger a summary.
            </li>
            <li>
              <strong className="text-foreground">
                Anonymous device identifier:
              </strong>{" "}
              A random UUID generated locally and stored in{" "}
              <code className="rounded bg-white/[0.06] px-1 py-0.5 text-xs">
                chrome.storage.local
              </code>
              . Used solely to enforce the free daily quota for unauthenticated
              users. It is never tied to your real identity and is never used
              for advertising, tracking, or profiling.
            </li>
            <li>
              <strong className="text-foreground">
                Supabase session tokens:
              </strong>{" "}
              If you sign in with Google, the access token and refresh token
              issued by Supabase Auth are stored in{" "}
              <code className="rounded bg-white/[0.06] px-1 py-0.5 text-xs">
                chrome.storage.local
              </code>{" "}
              so the extension can authenticate API calls. They are cleared when
              you sign out.
            </li>
            <li>
              <strong className="text-foreground">
                Local preferences and cached profile:
              </strong>{" "}
              Your preferred summary language, default tab, and the last
              response from{" "}
              <code className="rounded bg-white/[0.06] px-1 py-0.5 text-xs">
                /api/extension/me
              </code>{" "}
              (email, preferred language, plan status, quota) are cached in{" "}
              <code className="rounded bg-white/[0.06] px-1 py-0.5 text-xs">
                chrome.storage.local
              </code>{" "}
              to render the UI instantly on reopen.
            </li>
            <li>
              <strong className="text-foreground">
                Quota metadata (anonymous users only):
              </strong>{" "}
              When an unauthenticated user triggers a summary, the request IP
              address and User-Agent string are recorded on the server against
              the anonymous device identifier to prevent quota abuse. This
              metadata is not linked to any account.
            </li>
          </ul>

          <h3 className="text-foreground pt-2 text-base font-semibold">
            Third-party processors
          </h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Transcripts and summaries are processed by the following services,
            strictly to deliver the feature you requested:
          </p>
          <ul className="text-muted-foreground flex flex-col gap-2 text-sm leading-relaxed">
            <li>
              <strong className="text-foreground">Google Gemini API</strong>:
              receives the video transcript to generate the summary (model{" "}
              <code className="rounded bg-white/[0.06] px-1 py-0.5 text-xs">
                gemini-2.5-flash
              </code>
              ).
            </li>
            <li>
              <strong className="text-foreground">Supabase</strong>: stores the
              generated summary alongside the video ID, language, title, and
              channel ID so subsequent viewers receive a cached response without
              re-processing.
            </li>
            <li>
              <strong className="text-foreground">Cloudflare R2</strong>: stores
              the audio (TTS) rendering of summaries for Pro users.
            </li>
          </ul>

          <h3 className="text-foreground pt-2 text-base font-semibold">
            Retention
          </h3>
          <ul className="text-muted-foreground flex flex-col gap-2 text-sm leading-relaxed">
            <li>
              Session tokens are cleared from{" "}
              <code className="rounded bg-white/[0.06] px-1 py-0.5 text-xs">
                chrome.storage.local
              </code>{" "}
              when you sign out or uninstall the extension.
            </li>
            <li>
              Video summaries and audio renderings are cached indefinitely in
              our database and object storage so they can be re-served to you
              and to other viewers requesting the same video in the same
              language. They contain no personal information.
            </li>
            <li>Anonymous quota counters reset daily at 00:00 UTC.</li>
            <li>
              When you delete your BriefTube account, your profile, session
              tokens, subscriptions, and delivery records are erased within 30
              days (see Section 6).
            </li>
          </ul>

          <h3 className="text-foreground pt-2 text-base font-semibold">
            What the extension does NOT collect
          </h3>
          <ul className="text-muted-foreground flex flex-col gap-2 text-sm leading-relaxed">
            <li>
              No browsing history outside YouTube. The extension only runs on
              YouTube watch pages.
            </li>
            <li>
              No page content outside YouTube watch pages. Other tabs and
              websites are never read.
            </li>
            <li>
              No keystroke logging, form input capture, or clipboard access.
            </li>
            <li>
              No IP geolocation, precise location, or device fingerprinting.
            </li>
            <li>
              No advertising, analytics, or third-party tracking scripts are
              injected by the extension.
            </li>
            <li>
              No YouTube account data beyond the public video metadata of the
              page you are watching (the extension does not read your watch
              history, likes, comments, or subscriptions -- YouTube
              subscriptions are imported only via the separate opt-in flow in
              the web app, see Section 4).
            </li>
          </ul>

          <h3 className="text-foreground pt-2 text-base font-semibold">
            Data usage commitments
          </h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            In line with the Chrome Web Store Developer Program Policies, we
            affirm that data collected by the BriefTube extension:
          </p>
          <ul className="text-muted-foreground flex flex-col gap-2 text-sm leading-relaxed">
            <li>Is NOT sold or transferred to third parties.</li>
            <li>
              Is NOT used or transferred for purposes unrelated to the
              extension&apos;s single purpose (generating AI summaries of
              YouTube videos).
            </li>
            <li>
              Is NOT used or transferred to determine creditworthiness or for
              lending purposes.
            </li>
          </ul>

          <h3 className="text-foreground pt-2 text-base font-semibold">
            Your controls
          </h3>
          <ul className="text-muted-foreground flex flex-col gap-2 text-sm leading-relaxed">
            <li>
              <strong className="text-foreground">Sign out</strong> from the
              extension popup to immediately clear your session tokens from
              local storage.
            </li>
            <li>
              <strong className="text-foreground">Clear local data</strong> at
              any time via{" "}
              <code className="rounded bg-white/[0.06] px-1 py-0.5 text-xs">
                chrome://extensions
              </code>{" "}
              &rarr; BriefTube &rarr; &quot;Site access&quot; / &quot;Clear
              data&quot;, or by uninstalling the extension.
            </li>
            <li>
              <strong className="text-foreground">Delete your account</strong>{" "}
              from the dashboard Settings page, or by emailing{" "}
              <a
                href="mailto:contact@brief-tube.com"
                className="text-red-400 underline hover:text-red-300"
              >
                contact@brief-tube.com
              </a>
              . All server-side data associated with your account is removed
              within 30 days, subject to legal billing-retention obligations.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">12. Contact</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            For any questions about this Privacy Policy:
          </p>
          <a
            href="mailto:contact@brief-tube.com"
            className="text-sm text-red-400 underline hover:text-red-300"
          >
            contact@brief-tube.com
          </a>
        </section>
      </div>
    </div>
  );
}
