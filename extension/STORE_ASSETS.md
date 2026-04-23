# BriefTube — Chrome Web Store Asset Spec

This document is a production-ready brief for the visual assets required by the
Chrome Web Store listing of **BriefTube: AI YouTube summaries**. A designer
(or the product owner) can follow it end to end without further context.

The listing title is **"BriefTube: AI YouTube summaries"** and the one-line
pitch is: *"AI summaries of any YouTube video, right inside the watch page."*

---

## 1. Brand palette

Pulled from `extension/tailwind.config.js` (brand) and
`extension/src/styles/globals.css` (surface tokens, aligned with YouTube's
own design tokens so the sidebar blends in).

### Primary accent — red
| Role | Hex | Usage |
|------|-----|-------|
| Brand | `#DC2626` | Logo chip, primary CTA, tab active indicator, spinner |
| Brand dark (hover) | `#991B1B` | CTA hover, pressed state |

### Dark surface (default — matches YouTube dark mode)
| Role | Hex / rgba | Usage |
|------|-----------|-------|
| Background | `#0F0F0F` | Sidebar body |
| Background elevated | `#272727` | Header, tab bar, footer, dropdowns |
| Text primary | `#F1F1F1` | Headings, summary body |
| Text soft | `rgba(241,241,241,0.92)` | Paragraphs |
| Text muted | `#AAAAAA` | Labels, helper text |
| Text dim | `rgba(241,241,241,0.45)` | Metadata, placeholders |
| Border | `rgba(255,255,255,0.1)` | 1px dividers |
| Hover bg | `rgba(255,255,255,0.05)` | Row/button hover |
| Hover bg strong | `rgba(255,255,255,0.1)` | Chapter timestamp chips |
| Pro green (Pro badge / confirmed states) | `#34D399` (emerald-300) | "Pro: unlimited summaries", "Subscribed" |

### Light surface (used when YouTube is in light mode)
| Role | Hex | Usage |
|------|-----|-------|
| Background | `#FFFFFF` | |
| Background elevated | `#F2F2F2` | |
| Text primary | `#0F0F0F` | |
| Text muted | `#606060` | |
| Border | `rgba(0,0,0,0.1)` | |

**Rule:** all screenshots and promo tiles use the **dark palette**. It reads
better as a thumbnail, matches the default YouTube experience, and gives the
red accent maximum contrast.

### Typography
- Font: `ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif`
- Do **not** substitute a display font. Keep the system sans consistent with
  what the extension actually ships.

### Logo mark
- The extension's icon is the Lucide `Zap` glyph, filled white, inside a
  brand-red rounded square (8 px radius at 32 px size). Use the same mark on
  promo assets.

---

## 2. Small promo tile — 440 × 280 PNG (required)

### Hierarchy
1. **Headline** — single line, centered vertical-ish, dominates the frame.
2. **BriefTube wordmark + Zap logo** — top-left or bottom-left corner.
3. **Optional** — a tiny sliver of the sidebar UI bleeding in from the right,
   clipped. Keep it *decorative*, not readable.

### Hero copy — pick one (≤ 5 words)
- **"Summarize any YouTube video."** ← recommended, plainest
- "AI summaries inside YouTube."
- "Skip the fluff. Read the gist."
- "Every video, in 30 seconds."

### Visual composition
- Background: solid `#0F0F0F`.
- Top-left: 28 × 28 brand-red rounded square with white Zap glyph, followed by
  "BriefTube" wordmark in `#F1F1F1`, 14 px semibold.
- Center: headline in `#F1F1F1`, 32–36 px bold, max 2 lines. Tracking tight
  (-0.01 em).
- Bottom-right: a single 1-pixel soft-red glow (`#DC2626` at 20 % opacity,
  40 px blur) to catch the eye. No gradient fills.
- Optional right-edge bleed: 120 px wide slice of the sidebar, clipped to the
  right edge, showing the Summary tab active. Fades to the background via a
  hard mask (no gradient).

### Accessibility
- Headline must remain legible when the tile is displayed at **220 × 140 px**
  (the Chrome Web Store thumbnail size). Test by rendering the export at
  50 % zoom before shipping — if you can't read it, increase type size and
  drop any secondary copy.
- Contrast ratio ≥ 7:1 (white on `#0F0F0F` passes trivially).

### Don'ts
- No YouTube logo, no YouTube-red play triangle, no "as seen on YouTube"
  wording.
- No stock icons. Use the exact Lucide `Zap` from the extension.

---

## 3. Marquee — 1400 × 560 PNG (optional, required to be "Featured")

The wider canvas lets us show a device mockup + sidebar in context.

### Layout (three zones, left → right)
- **Left third (≈ 460 px)** — headline block on solid `#0F0F0F`.
  - Brand lockup top-left (Zap logo + wordmark).
  - Headline, 56–64 px bold: **"Summarize any YouTube video."**
  - Sub-line, 20 px regular `#AAAAAA`: "AI-generated key points in your
    language, free for 3 videos a day."
  - Single CTA pill, brand red `#DC2626`, white text: "Add to Chrome" (pure
    decoration — no functional button).
- **Right two-thirds (≈ 940 px)** — a realistic YouTube watch-page
  screenshot (dark theme, chrome Mac-style window frame or edge-to-edge,
  designer's call) with the BriefTube sidebar visible on the right, Summary
  tab active, showing the first 6–8 lines of a cached summary.
- **Framing** — drop a subtle shadow (`rgba(0,0,0,0.4)`, 40 px blur, 10 px Y)
  under the mockup to lift it off the background. No gradient.

### Copy variants for the sub-line
- "AI-generated key points in your language, free for 3 videos a day."
- "Read the gist in 30 seconds — 55+ languages supported."

### Don'ts
- Do not render the sidebar floating in empty space. It must appear docked to
  a real YouTube page to communicate the product immediately.
- No emoji, no stock "happy user" photography.

---

## 4. Five screenshots — 1280 × 800 PNG each

All five screenshots are **full YouTube watch page + BriefTube sidebar**,
captured at 1280 × 800 in Chrome dark mode. The narrative below front-loads
the core value prop, then layers on differentiators.

### Screen 1 — "Summarize any video, instantly"
- **State to capture**: Video loaded, BriefTube sidebar on the right, Summary
  tab active, summary fully rendered (4–6 paragraphs visible without
  scrolling).
- **Video suggestion**: `https://youtube.com/watch?v=nm1TxQj9IsQ` — the demo
  video pre-summarized per `CLAUDE.md`. Guaranteed cache hit, so the summary
  appears within ~300 ms and looks clean.
- **Annotate**: a thin red rectangle (2 px, `#DC2626`, 8 px radius) around
  the whole sidebar to draw the eye. Nothing else.
- **Caption overlay (top, 40 px from top, centered)**: **"AI summaries,
  right on the watch page."**

### Screen 2 — "3 free summaries a day, no signup"
- **State to capture**: Sidebar with the signed-out header visible — the
  quota pill reads **"3 free summaries left today"** with a "Sign in for
  more" pill next to it. Summary already rendered below.
- **How to produce**: clear extension storage / use a fresh Chrome profile
  so `authenticated=false` and `me.quota.remaining=3`.
- **Video suggestion**: any video that has YouTube auto-captions; TED talk
  works well (evergreen + safe visual).
- **Annotate**: small red underline under the "3 free" badge and the "Sign
  in for more" pill. Optional: a soft red glow around the quota pill.
- **Caption overlay**: **"Free to try — no signup needed."**

### Screen 3 — "55+ languages"
- **State to capture**: Signed-in state, account menu **open**, Language
  picker **expanded** showing the scrollable list of flags/labels (English,
  Français, Español, Deutsch, 日本語, العربية visible at minimum — pick a
  scroll position that shows at least one non-Latin script).
- **How to produce**: sign in, open avatar menu, click the language
  dropdown. Freeze the frame before the menu closes.
- **Annotate**: red arrow pointing at the currently selected flag, or a red
  rectangle around the expanded list.
- **Caption overlay**: **"Read summaries in 55+ languages."**

### Screen 4 — "Listen on the go (Pro)"
- **State to capture**: Sidebar Audio tab active, for a Pro user with audio
  ready. The native `<audio>` player is visible with a real duration
  (>0:00). The Pro green badge "Pro: unlimited summaries" is visible in the
  header.
- **How to produce**: sign in as a Pro account, land on a video whose
  summary already has `audio_url` populated (query `processed_videos` for
  one where `audio_url IS NOT NULL`). Switch to Audio tab.
- **Annotate**: small red "PRO" pill callout pointing at the audio player, or
  a red underline under "Pro: unlimited summaries".
- **Caption overlay**: **"Turn summaries into audio. Commute ready."**

### Screen 5 — "Subscribe → auto-delivery to Telegram / Discord"
- **State to capture**: Sidebar Summary tab, footer **"Subscribe to
  {channelName}"** button hovered or in the `subscribed === "done"` state
  showing **"Subscribed to auto-summaries"** in emerald.
- **How to produce**: sign in, land on a channel you haven't subscribed to,
  capture the idle state for variant A; click subscribe and capture the
  confirmed state for variant B. Ship variant B (more convincing outcome).
- **Annotate**: red arrow from the emerald footer row pointing outward
  toward a small, tasteful group of three monochrome platform icons
  (Telegram paper-plane, Discord, envelope) drawn to the right of the
  frame. Icons must be generic (line icons, not brand logos) to avoid
  trademark issues — or omit icons entirely and keep just the arrow +
  caption.
- **Caption overlay**: **"Auto-summaries in Telegram, Discord, or email."**

### Caption overlay style (all five)
- Font: system sans, 22 px semibold.
- Color: `#F1F1F1` on a `rgba(0,0,0,0.65)` pill (16 px horizontal padding,
  8 px vertical, 999 px radius).
- Pinned at the top, 32 px from the edge, centered horizontally.
- Keep every caption ≤ 8 words so it survives the store's own scaling.

---

## 5. Capture instructions

### Environment
- Chrome (stable) running the **production** build of the extension loaded
  from `extension/dist/` (or the zip submitted to the store).
- A **fresh Chrome profile** dedicated to screenshots — no extensions
  besides BriefTube, no bookmarks bar, no pinned tabs.
- Disable uBlock Origin / AdGuard / etc. for these captures to avoid empty
  ad slots or "blocked" placeholders. We want the vanilla YouTube look.
- Dismiss the YouTube cookie banner and the "Sign in to YouTube" overlay
  before capturing — they cover the sidebar on some accounts.
- Ensure YouTube is in **dark mode** (account menu → Appearance → Dark).

### Viewport
- DevTools → **Toggle device toolbar** → Responsive → set to **1280 × 800**
  at **DPR 2** (retina). Export will be 2560 × 1600; downscale to
  1280 × 800 on export to keep file size manageable.
- Zoom must be 100 %. Do not use Cmd/Ctrl +/- before capturing — YouTube's
  layout shifts.

### Chrome profile state per screen
| Screen | Auth | Quota | Plan | Videos to use |
|-------|------|-------|------|---------------|
| 1 | Signed in, no avatar artifacts | any | free | `nm1TxQj9IsQ` (pre-cached demo) |
| 2 | **Signed out** | 3/3 remaining | — | Any captioned TED talk or popular English video |
| 3 | Signed in | any | free or pro | Any video with the sidebar open + menu opened |
| 4 | Signed in | any | **Pro** | A video with `audio_url` ready (query DB) |
| 5 | Signed in | any | free or pro | A channel the account is **not** yet subscribed to |

### Background rules
- Top nav: default YouTube, logged-in avatar circle present on screens 1,
  3, 4, 5. Generic letter avatar is fine — avoid real user photos.
- No browser notification bubbles, no "Chrome is up to date" banner.
- Close DevTools before capturing.
- Hide any extension toolbar icons that aren't BriefTube (Chrome → Extensions
  → Pin = off for everything else).

### Tools
- **Chrome DevTools Device Mode** set to 1280 × 800 — then *right-click the
  viewport → Capture screenshot* (full DPR, no OS chrome).
- Or **Cleanshot X / Shottr / built-in Screenshot tool** with a 1280 × 800
  fixed-size selection overlay.
- Do **not** use browser full-page screenshot if it stitches — it
  sometimes adds artifacts around sticky headers.

### Post-process
- Crop or constrain to **exactly 1280 × 800** (Chrome Web Store will reject
  mismatched aspect ratios).
- Export as **PNG**, ≤ 5 MB each. PNG-24, no transparency needed.
- Paste caption overlays in a design tool (Figma / Affinity / Sketch) on a
  separate layer so they remain editable if copy changes.
- Run through `pngquant --quality 80-95` if file size approaches the cap.

---

## 6. Caption variants per screenshot

For each screenshot, pick whichever variant scans faster. All are ≤ 8 words.

### Screen 1
- A — **"AI summaries, right on the watch page."**
- B — **"Skip the fluff. Get the key points."**

### Screen 2
- A — **"Free to try — no signup needed."**
- B — **"3 free summaries a day, forever."**

### Screen 3
- A — **"Read summaries in 55+ languages."**
- B — **"Your language. Any video. One click."**

### Screen 4
- A — **"Turn summaries into audio. Commute ready."**
- B — **"Listen anywhere. Your videos, your voice."**

### Screen 5
- A — **"Auto-summaries in Telegram, Discord, or email."**
- B — **"New video? Summary lands in your chat."**

---

## 7. Don'ts (non-negotiable)

- **No fake testimonials.** Not even placeholder ones — the review team flags
  these even when marked as mockups.
- **No "#1 extension" / "best-in-class" / "100 % accurate"** claims. Summaries
  are AI-generated and can be wrong; the store rejects superlative or
  unverifiable claims.
- **No YouTube logo, no YouTube red play triangle, no "Google" wordmark** in
  any way that implies endorsement or partnership. Using a YouTube watch page
  as the *background* is fine and necessary; re-using their logo as a visual
  element is not.
- **No "official YouTube extension"** wording anywhere.
- **No competitor names** ("Better than Summarize.tech", etc.).
- **No testimonial-style quotes** with fake attributions.
- **No emojis** anywhere on the assets (product rule — we use Lucide icons
  only).
- **No gradients** on backgrounds or buttons unless explicitly approved — the
  product style is flat, solid surfaces with a single accent color.
- **No real user photos or names** in the avatar slot of screenshots. Use a
  generic letter avatar or an anonymous silhouette.
- **No pricing claims** ("from $X/month") on screenshots unless they match
  the live `/pricing` page exactly at time of submission.
- **No "works on Firefox / Edge / Safari"** — this listing is Chrome-only.
