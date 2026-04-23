# BriefTube — Chrome Web Store Asset Spec

Production brief for the visual assets required by the Chrome Web Store listing of **BriefTube: AI YouTube summaries**. Style modeled on the Eightify store listing (same genre, same format, proven to convert) but re-skinned with BriefTube branding.

---

## 1. Visual language (shared across all assets)

All assets use the same layout template so the listing reads as one cohesive set rather than 5 random screenshots.

### Background
- Base: solid `#0F0F0F` (YouTube dark)
- Two diffuse radial "auras" to break the flatness:
  - Top-left: `#7C1F1F` (deep brand red), ~60% opacity, ~800 px radius, feathered
  - Bottom-right: `#1E1B4B` (deep violet-blue), ~60% opacity, ~800 px radius, feathered
- A subtle noise/grain overlay at 3% opacity to avoid banding

This matches the Eightify mood (dark + coloured aura) but trades their purple for our brand red as the dominant aura. Keeps the red strong without painting the whole frame red.

### Typography
- Headline: Inter or Geist, **700 weight, 56–64 px**, pure white `#FFFFFF`, tight leading (1.05)
- Sub-headline: Inter 500 weight, 22–24 px, `#AAAAAA` (matches `--bt-text-muted` in-extension), leading 1.35
- Max 2 lines for each. If the sub-headline overflows, cut words, don't shrink.
- **No emojis. No exclamation marks.** Confident, not marketing-shouty.

### Screenshot treatment
- Source: actual sidebar rendered on a real YouTube watch page, captured at 1280×800 viewport
- Apply:
  - 12 px border-radius on the screenshot itself
  - Subtle white outline: `1 px solid rgba(255,255,255,0.08)`
  - Drop shadow: `0 40px 80px -16px rgba(0,0,0,0.6)`
  - **Optional slight 3D tilt**: `perspective(1600px) rotateY(-2deg)` for screens 1, 3, 4, 5. Not screen 2 (grid collage).

### Cursor
For the "interaction" screens (3 and 5), draw a macOS-style pointing-hand cursor (⌘ design — not the Chrome default). Size ~42 px. The cursor hovers the exact element the caption is talking about.

### Layout template
- Canvas: 1280×800
- Headline anchor: 72 px from top, horizontally centered, ~800 px max width
- Sub-headline: 12 px below headline
- Screenshot: bottom-aligned, ~80 px bottom margin, ~1000 px wide, centered
- ~120 px of background visible around the screenshot edges — this is where the auras breathe

---

## 2. Brand palette reference

| Token | Hex | Usage |
|-------|-----|-------|
| Brand red | `#DC2626` | Aura highlight, icon fill |
| Brand red dark | `#991B1B` | Aura core |
| Background | `#0F0F0F` | Canvas base |
| Surface elevated | `#272727` | Sidebar background in screenshots |
| Text primary | `#F1F1F1` | Headlines |
| Text muted | `#AAAAAA` | Sub-headlines |
| Border | `rgba(255,255,255,0.08)` | Screenshot outline |

---

## 3. The 5 screenshots (1280×800 each)

Narrative arc: **what it does → free tier hook → killer UX → global reach → Pro upsell.** This order mirrors Eightify's but swaps their "customize length" screen for our unique **channel subscribe** feature, since that's the moat.

### Screen 1 — "Save time on long videos"

- **Headline**: `Save time on long videos`
- **Sub-headline**: `Get the key points in seconds, not minutes`
- **State**: Sidebar open on a real video (Huberman Lab or Lex Fridman — `nm1TxQj9IsQ` is pre-cached in DB and renders instantly). Summary tab active, summary fully populated, quota pill visible ("3 free summaries today" for anon or "Pro · unlimited" for signed-in Pro).
- **Highlight**: nothing extra; the rendered summary does the job
- **Alt caption**: `Key insights, instantly`

### Screen 2 — "Summarize anything"

- **Headline**: `Summarize anything on YouTube`
- **Sub-headline**: `Tutorials, podcasts, news, reviews, and more`
- **State**: NOT a product screenshot — this is the "genre wall" collage, the only screen that breaks the template.
  - A 3×4 grid of 12 YouTube thumbnails (mix of genres: AI/tech podcast, business, news, fitness, cooking, gaming, review, education, science, comedy). Use thumbnails of **your own subscribed channels or demo videos only** — do not reuse copyrighted thumbnails of big creators you don't have permission from.
  - Thumbnails at 12 px border-radius, subtle shadow. No overlays.
  - Collage centered, ~1080 px wide total.
- **Tilt**: none
- **Alt caption**: `Any genre, any channel`

### Screen 3 — "Jump to the exact moment"

- **Headline**: `Jump to the exact moment`
- **Sub-headline**: `Click any timestamp to seek instantly`
- **State**: Sidebar Transcript tab open, timestamped lines visible (these are the clickable timecode rows). Summary tab badge still visible so the user sees tab navigation.
- **Cursor**: hand-pointing cursor hovering a specific timestamp (e.g. "06:51"). Draw a faint circular spotlight (radial gradient, white at 15% opacity, 80 px radius) centered on the cursor to focus the eye.
- **Alt caption**: `Navigate any video with a click`

### Screen 4 — "Understand videos in any language"

- **Headline**: `Understand videos in any language`
- **Sub-headline**: `Summaries translated to your language — 55+ supported`
- **State**: Video is a non-English YouTube video (Spanish, Japanese, or German). Sidebar Summary tab shows the summary **in French** (or English — pick whichever your target market speaks). Language picker dropdown is **open**, showing ~6 flag entries visible: 🇬🇧 🇫🇷 🇪🇸 🇩🇪 🇯🇵 🇰🇷. Current language has the ✓ checkmark.
- **Highlight**: none — the open dropdown is the focus
- **Alt caption**: `Summaries in your language`

### Screen 5 — "Never miss a new video"

This is BriefTube's **unique feature** vs Eightify/Glasp/Notegpt. Make it shine.

- **Headline**: `Never miss a new video`
- **Sub-headline**: `Subscribe once, new summaries delivered to Telegram, Discord, or email`
- **State**: Sidebar with the "Subscribe to channel" footer button in **success state** (emerald background, "Subscribed" label). The Summary tab is populated so the UI isn't empty above the button.
- **Cursor**: hand-pointing cursor on the Subscribe button
- **Side panel (optional)**: a small stacked "toast" at the top-right corner of the canvas mocking a Telegram notification: *"New summary from Andrew Huberman — 2m read"*. Drawn as a Telegram-looking card but without the actual Telegram logo (use a generic chat icon — avoid trademark).
- **Alt caption**: `Auto-summaries on new uploads`

---

## 4. Small promo tile — 440×280 PNG (required)

The tile shows up at 220×140 in search, so legibility there is mandatory.

- Same background template (dark + red aura bottom-right)
- Left half: headline + sub-headline + BriefTube logo (the zap icon in a rounded-12 red `#DC2626` square, 48 px)
- Right half: a cropped sidebar screenshot, just the top (logo strip + tabs + first 2 lines of a summary), ~12 px radius
- **Headline**: `AI summaries for YouTube`
- **Sub-headline**: `Free. No account required to try.`
- **Logo lockup bottom-left**: small "BriefTube" wordmark in Geist Semibold
- **220×140 legibility test**: the headline must still be readable when you zoom out to ~50%. If not, drop the sub-headline and make the headline bigger.

---

## 5. Marquee 1400×560 PNG (optional, required for "featured" slots)

Two-pane composition to fill the wide aspect ratio without empty space.

- **Left pane** (~55% width): the same headline as screen 1 (`Save time on long videos`) + sub-headline + BriefTube logo, all left-aligned
- **Right pane** (~45% width): a larger sidebar screenshot (same style as screen 1) with a slight 3D tilt `rotateY(-4deg)`, anchored to the right edge and clipped slightly off-frame — suggests "there's more, scroll to see"
- Aura: brand red in bottom-right, heavier than in the small tile
- No cursor
- No body copy beyond the sub-headline

---

## 6. Capture instructions

Identical conditions for every screenshot so the listing looks consistent.

### Browser setup
1. Chrome profile: logged in with a **Pro** account (so avatar + "Pro · unlimited" are visible; show anon state only on Screen 1 if you want to spotlight the "3 free/day")
2. Extensions disabled except BriefTube (no uBlock icons in the corner, no other extension sidebars)
3. Theme: YouTube in dark mode (gear → Appearance → Dark)
4. Language: match the target market language (English for the international store, French for France-specific variants)
5. No cookie banners (accept once, they'll stay hidden)
6. No logged-in Google sidebar guest promo

### Viewport
- Window size: exactly **1280×800** logical pixels
- DevTools Device Mode → Responsive → 1280×800, DPR = 2 for retina-sharp captures
- Zoom: 100% (Cmd/Ctrl + 0)

### Capture tool
- Chrome DevTools → Capture screenshot (Ctrl+Shift+P → "Capture full size screenshot")
- Or Puppeteer script if producing regularly

### Demo videos to use
- Screens 1, 5: `nm1TxQj9IsQ` (Huberman, pre-cached — always instant)
- Screen 3: any long video from the BriefTube dashboard cache; pick one with rich timestamps (interviews work best)
- Screen 4: a Spanish or Japanese video that's already been processed in BriefTube (check `processed_videos` for any non-English `source_language`)

### Post-process
- Export PNG, ≤5 MB each
- Crop to exactly 1280×800 (the listing will reject anything else)
- Apply the headline/sub-headline overlay in Figma, Photoshop, or an inline HTML + html2canvas pipeline

---

## 7. Caption variants (A/B material)

Pick whichever reads better per screen. In each pair, A is descriptive, B is outcome-focused.

| Screen | Variant A (descriptive) | Variant B (outcome) |
|--------|-------------------------|---------------------|
| 1 | Save time on long videos | Skip the intro, get the point |
| 2 | Summarize anything on YouTube | Every genre, one sidebar |
| 3 | Jump to the exact moment | Click a timestamp, skip ahead |
| 4 | Understand videos in any language | Translate any video in a click |
| 5 | Never miss a new video | Auto-delivered to your chat |

---

## 8. Don'ts

Non-negotiable, these get listings rejected:

- No YouTube logo used in any way that could imply endorsement from YouTube
- No "#1", "best", "better than Eightify", or any competitor comparison
- No fake testimonials or star ratings in the screenshots
- No "100% accurate" / "never wrong" / "always faster" absolute claims
- No emojis anywhere in captions
- No ALL CAPS marketing
- No screenshots with real users' YouTube comments or usernames visible (privacy)
- No creator's copyrighted thumbnail used as a featured visual unless you own the rights (cancel the genre collage on screen 2 if in doubt — the store has rejected listings for this)

---

## 9. Reference source

The style template is openly modeled on the Eightify Chrome Web Store listing screenshots (reviewed 2026-04-23). Eightify uses:
- Dark + purple aura background
- Large white headline + muted sub-headline, centered top
- Screenshot in soft perspective tilt, bottom-anchored
- Hand cursor callout on interactive frames

BriefTube adopts the same skeleton but swaps:
- Purple aura → brand red aura (bottom-right)
- Customize-length screen → channel-subscribe screen (our differentiator)
- Competitor avoids explicit pricing claims → BriefTube leads with "3 free, no account"

The result is a listing that looks native in the same category (users recognize the format) but reads as a distinct product.
