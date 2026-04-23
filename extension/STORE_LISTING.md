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

`Personalized AI summaries for YouTube. Subscribe to channels to auto-summarize every new upload. 55+ languages.` (111 chars)

### Detailed description (max 16,000 characters)

```
BriefTube turns every YouTube video into a personalized summary you can read or listen to — and auto-summarizes every new upload from the channels you subscribe to, so you stay caught up without ever watching a 40-minute video you did not need.

Tailored to how you read

You pick how the summary is delivered, and BriefTube writes to your spec every time:

- Length: brief (one paragraph), standard (balanced), or detailed (thorough)
- Style: narrative prose, key-point list, or actionable takeaways
- Language: 55+ supported, translated regardless of the video's original language

The sidebar sits next to the YouTube player. Open any video, get the summary rewritten in your style, in your language, in seconds.

Auto-summarize the channels you follow

Subscribe to a channel once from the sidebar and BriefTube will automatically summarize every new video the creator uploads — delivered to you on Telegram, Discord, or email through the BriefTube service at brief-tube.com. No refreshing a watch-later list, no catching up after a two-week trip. New upload, new summary, in your inbox or chat.

Listen instead of reading (Pro)

Every summary can be played as audio using a natural Edge TTS voice. Commute, workout, dishes — a fifteen-minute video becomes a two-minute audio brief. This is the Pro tier.

Transparent pricing, no hidden paywall

- Anonymous: 3 personalized summaries per day, no account, no credit card
- Free account (Google sign-in): 10 per day, plus automatic channel summaries
- Pro: unlimited summaries, audio briefs, priority processing, multi-platform delivery (Telegram, Discord, email)

The free anonymous tier is not a trial. It resets every day and costs you nothing. You only sign in when you want more — and you only pay if you want audio or unlimited volume.

Privacy first

No account required to try. When you use BriefTube anonymously, the only thing stored on your device is a random UUID used to count your daily quota. No email, no name, no ad-tracking cookies. When you sign in, the extension uses Supabase with Google OAuth and stores only the session token locally.

Videos are summarized on BriefTube's servers using Google Gemini. Summaries are cached so repeat requests for the same video are instant. Nothing is sold, tracked for advertising, or shared outside the processing pipeline.

Full privacy policy: https://www.brief-tube.com/privacy

How it works

1. Install the extension and open any video on youtube.com.
2. The BriefTube sidebar appears next to the player. Click Summarize.
3. Open the menu to set your preferred language, summary length, and style — every future summary is written that way until you change it.
4. To unlock audio briefs, channel auto-summaries, and multi-platform delivery, sign in with Google and upgrade to Pro when you are ready.

What BriefTube handles for you

- Videos with YouTube captions: summarized instantly from the existing transcript
- Videos without captions: transcribed automatically via BriefTube's server-side pipeline, then summarized — so you still get a summary when the creator did not publish subtitles
- Videos in any of 55+ languages: translated to your preferred language before summarizing
- Long videos: no arbitrary length caps — podcasts, lectures, and live streams are supported

What the extension does not do

- Does not download video or audio files from YouTube
- Does not modify, block, or replace YouTube's player, ads, or recommendations
- Does not read any pages outside youtube.com and brief-tube.com
- Does not run remote code — every script is bundled into the extension package at build time

Links

- Website: https://www.brief-tube.com
- Privacy policy: https://www.brief-tube.com/privacy
- Support and contact: https://www.brief-tube.com/support

BriefTube is built and maintained as part of the BriefTube SaaS at brief-tube.com. The extension is the fastest way to try the product; the web app adds channel monitoring, multi-platform delivery, and a long-term summary library.
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