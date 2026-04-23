# Chrome Web Store — BriefTube listing copy

All copy is reviewer-ready. Plain prose, no emojis, no ALL CAPS, no competitor names, no testimonials.

---

## 1. Store listing content

### Extension name (max 75 characters)

**Primary (already set in manifest):**

- `BriefTube: AI YouTube summaries` (32 chars)

**Alternatives if Google rejects for trademark or brand-pattern reasons:**

1. `BriefTube — Summaries and audio briefs for YouTube` (52 chars)
2. `BriefTube — AI recap, transcript and audio for YouTube videos` (62 chars)

Both alternatives keep the brand first, drop the "YouTube" adjective into descriptor position, and front-load the actual function (summaries, transcript, audio).

### Short summary (max 132 characters)

`Summarize any YouTube video in seconds. Read, listen, or get the full transcript from a sidebar on the watch page.` (114 chars)

### Detailed description (max 16,000 characters)

```
BriefTube adds a sidebar to every YouTube watch page that turns the video you are watching into a short written summary, an audio brief you can listen to, and the full searchable transcript. It runs in your browser — open the video, click the BriefTube button, get the gist in under thirty seconds.

The goal is simple: stop wasting time on videos that could have been a paragraph. Scan the summary first, then decide whether the video is worth twenty minutes of your attention. If it is, you still have the transcript to jump straight to the interesting part.

What you can do with BriefTube

- Generate a structured summary of the current YouTube video, with key points and timestamps
- Listen to an audio version of the summary (Pro), useful for commutes or chores
- Read the full transcript in a searchable panel, with click-to-seek timestamps
- Switch the output language — summaries are produced in the language you prefer, not the video's
- Subscribe to a YouTube channel with one click and receive every new video's summary via Telegram, delivered by the BriefTube service at brief-tube.com
- Copy the summary or transcript to paste into your notes, chat, or document

Pricing, up front

- Anonymous use: three summaries per day, no account required, no email asked
- Free account (sign in with Google): ten summaries per day
- Pro plan: unlimited summaries, audio briefs, priority processing, and channel subscriptions delivered via Telegram

There is no hidden paywall. The three daily anonymous summaries are not a trial — they reset every day and cost you nothing. You only sign in when you want more, and you only pay if you want audio and unlimited volume.

Privacy position

BriefTube does not require an account to try. When you use it anonymously, the only identifier stored on your device is a random UUID used to count your daily quota — no email, no name, no cookies from ad networks. When you sign in, BriefTube uses Supabase authentication with Google OAuth; the extension stores a session token locally so you stay signed in between tabs.

Video transcripts and the resulting summaries are processed on BriefTube's servers using Google Gemini, then cached so that repeat requests for the same video are instant and cheaper for everyone. Summaries and transcripts are not sold, not used for advertising, and not shared with third parties outside the processing pipeline.

Full details: https://www.brief-tube.com/privacy

How to use it

1. Install the extension and open any video on youtube.com.
2. The BriefTube sidebar appears next to the player. Click "Summarize" to generate the summary, or open the Transcript tab to read the full text.
3. To get audio briefs, channel subscriptions, and unlimited daily summaries, click "Sign in" in the extension popup and connect your Google account.

Supported surfaces

- youtube.com watch pages, in every language supported by YouTube captions
- Videos without captions are handled through BriefTube's server-side transcription pipeline, so you can still get a summary when the creator did not publish subtitles

What this extension does not do

- It does not download videos or audio files from YouTube
- It does not modify, block, or replace YouTube's player, ads, or recommendations
- It does not run remote code — every script is bundled into the extension package at build time
- It does not read pages outside of youtube.com and brief-tube.com

Links

- Website: https://www.brief-tube.com
- Privacy policy: https://www.brief-tube.com/privacy
- Support and contact: https://www.brief-tube.com/support

BriefTube is built and maintained as part of the BriefTube SaaS at brief-tube.com. The extension is the fastest way to try the product; the web app adds channel monitoring, multi-platform delivery, and long-term summary history.
```

### Category

**Recommended:** `Productivity`

Reasoning: the primary use case is saving time on video consumption (read a summary instead of watching). "Workflow and Planning" is too narrow. "News and Weather" does not fit. "Accessibility" would be a stretch despite the transcript feature — Chrome reviewers reserve that category for assistive-technology extensions.

### Primary language

`English (United States)` — en-US

The landing page, billing flow, and in-app UI all default to English. French and other languages are supported at runtime via the summary output language setting, but the store listing itself should be English to maximize reach and avoid localized-review complications.

---

## 2. Single-purpose description

```
This extension generates AI-powered summaries, audio briefs, and full transcripts of YouTube videos directly on the youtube.com watch page, and lets signed-in users subscribe to channels for delivery through the BriefTube service.
```

One sentence, narrow, tied to a single user-visible surface (the YouTube watch page).

---

## 3. Permission justifications

### `storage`

```
Used to persist the anonymous device ID (UUID, used to count the free daily summary quota), the Supabase session token when the user signs in, and UI preferences such as the chosen summary output language. Without chrome.storage the user would lose their quota counter, session, and preferences on every page reload.
```

### Host permission — `https://www.youtube.com/*` and `https://m.youtube.com/*`

```
The extension injects its sidebar into youtube.com watch pages and reads the current video ID plus the page's built-in caption track list so it can generate a summary of the video the user is currently watching. Without this host permission the content script cannot run on the page where the feature is useful.
```

### Host permission — `https://*.brief-tube.com/*` and `https://brief-tube.com/*`

```
The extension calls BriefTube's HTTPS API to request summaries, audio briefs, and transcripts, and runs a tiny content script on brief-tube.com/extension/auth to receive the Supabase session token after a successful Google sign-in. Without this host permission sign-in cannot complete and no summaries can be generated.
```

### Remote code

```
Not applicable. The extension does not execute remote code. All JavaScript is bundled into the CRX package at build time using Vite; the extension only makes standard HTTPS fetch calls to its own API and never evaluates strings, injects <script> tags, or loads remote modules at runtime.
```

---

## 4. Data-usage disclosures (three certified statements)

```
I do not sell or transfer user data to third parties, outside of the approved use cases.
I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
I do not use or transfer user data to determine creditworthiness or for lending purposes.
```

All three boxes should be checked. These statements are literally the text Google requires under the "Certifications" section of the Privacy tab — do not reword them.

---

## 5. Data types collected (Privacy tab)

Check the following boxes and paste the matching one-sentence justification into each box's "How is this data used" field.

### Personally identifiable information — YES

```
The user's email address is collected once, at Google OAuth sign-in, to identify their account and send transactional emails (billing receipts, feature notifications); the extension stores only the resulting Supabase session token, not the email itself.
```

### Authentication information — YES

```
The extension stores the Supabase session token (JWT) and refresh token in chrome.storage.local after Google sign-in, so the user stays signed in between browser sessions without re-entering credentials.
```

### Website content — YES

```
For each summary request the extension sends the YouTube video ID of the currently open watch page to the BriefTube server, which fetches the public transcript for that video; the transcript text is processed by Google Gemini to produce the summary and is cached server-side for reuse.
```

### User activity — YES (minimal)

```
An anonymous random UUID (device_id) is stored locally and sent with each summary request so the server can enforce the three-per-day free quota for anonymous users and the ten-per-day quota for signed-in free users; this identifier is not linked to any profile or advertising network.
```

### Do NOT check

- Personal info (name, address, phone) — not collected
- Financial and payment info — handled entirely by Stripe on brief-tube.com, never touched by the extension
- Health info — not collected
- Location — not collected (no geolocation, no IP-based geo)
- Web history — not collected (the extension only sees the YouTube page the user is actively on and only when they click the sidebar)
- Communications (emails, messages) — not collected

---

## 6. Pre-submission checklist

- [ ] `manifest.prod.json` version number bumped and matches the ZIP name
- [ ] `permissions` contains only `storage` — no `tabs`, `activeTab`, `scripting`, `cookies`, `webRequest`, or `<all_urls>`
- [ ] `host_permissions` limited to the four YouTube and brief-tube.com entries; no wildcard `*://*/*`
- [ ] Privacy policy at https://www.brief-tube.com/privacy is reachable, mentions the extension by name, and lists every data type declared in the Privacy tab
- [ ] Support URL at https://www.brief-tube.com/support is reachable and responds to contact attempts within a reasonable window
- [ ] Screenshots (1280x800 or 640x400, exactly) show the real sidebar on a real YouTube page, no mockups, no unrelated product UI, no competitor logos
- [ ] Promo tile images do not contain "Chrome Web Store" branding, Google logos, or claims like "best" / "#1"
- [ ] Detailed description does not name competitors, does not claim partnership with YouTube or Google, does not use the YouTube logo outside of fair-use descriptive text
- [ ] Single-purpose description and detailed description agree on what the extension does (reviewers cross-check)
- [ ] ZIP file contains only the built `dist/` output — no source maps pointing to private URLs, no `.env` files, no `node_modules`
- [ ] Built bundles are readable by a human reviewer (Vite default output, not uglified beyond recognition); no eval, no Function constructors, no dynamic imports of remote URLs
- [ ] Background service worker does not call `chrome.tabs.executeScript` or inject additional content scripts at runtime beyond the ones declared in the manifest
- [ ] Account creation is not strictly required to use the extension (anonymous tier works) — this is called out in the store description, which protects against the "requires login to evaluate" rejection
- [ ] OAuth redirect URI used by `chrome.identity.launchWebAuthFlow` matches exactly what is registered in Supabase; reviewers often test sign-in on a fresh profile
- [ ] Developer Dashboard contact email is monitored; Google sometimes requests clarifications via email before rejecting, and a missed reply delays the review by days
```