# BriefTube Chrome Extension

Complete documentation for the BriefTube browser extension.

## TL;DR

- **What** — Manifest V3 Chrome extension that injects a summary sidebar into `youtube.com/watch?v=…` pages.
- **Why** — Eightify dominates this market with a notoriously hostile UX (hard paywall, credit card required to try, 1 summary per day free). Every 1★ review of Eightify is an opportunity. See `extension/README.md` for the grievance-by-grievance response matrix.
- **How it saves money vs the web app** — The content script reads `ytInitialPlayerResponse` and fetches caption tracks using the user's own YouTube session. ≥80% of videos ship with native captions, which means we skip the worker entirely (no Invidious/Piped/yt-dlp/Whisper cost, no proxy bills, no YouTube IP rate-limiting) and go straight to a Gemini Flash call. Gemini Flash costs ≈ 0.0003 $/summary, so the free tier is effectively free to serve.

## File map

```
BriefTube/
├── EXTENSION.md                     # ← you are here
├── app/
│   ├── api/extension/               # Server endpoints scoped to the extension
│   │   ├── me/route.ts              # Quota + profile (GET)
│   │   ├── summarize/route.ts       # Fast path: transcript+Gemini (POST)
│   │   ├── enqueue/route.ts         # Fallback: queue for worker (POST, auth)
│   │   ├── status/[videoId]/route.ts  # Poll for worker result (GET)
│   │   └── subscribe-channel/route.ts # One-click subscribe (POST, auth)
│   └── extension/
│       ├── auth/                    # OAuth bridge for chrome.identity flow
│       │   ├── page.tsx
│       │   └── _components/extension-auth-bridge.tsx
│       └── welcome/page.tsx         # Post-install onboarding page
├── extension/                       # The extension itself (Vite + CRXJS)
│   ├── manifest.json                # MV3 manifest
│   ├── vite.config.ts               # Build config
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── .browserslistrc              # Forced to avoid inheriting root browserslist
│   ├── public/icons/                # 16/32/48/128 PNGs
│   ├── README.md                    # Short dev usage notes
│   └── src/
│       ├── auth/                    # OAuth callback landing page
│       │   ├── callback.html
│       │   └── callback.ts
│       ├── background/index.ts      # Service worker (message broker + auth flow)
│       ├── content/                 # Everything that runs on youtube.com
│       │   ├── index.tsx            # React mount + SPA detection
│       │   ├── sidebar.tsx          # UI: tabs, footer, quota, CTAs
│       │   └── transcript.ts        # Caption extraction helpers
│       ├── popup/                   # Toolbar popup
│       │   ├── index.html
│       │   ├── main.tsx
│       │   └── Popup.tsx
│       ├── lib/
│       │   ├── api.ts               # fetch wrapper with Bearer auth
│       │   ├── config.ts            # API base, storage keys
│       │   ├── storage.ts           # chrome.storage helpers (device_id, session)
│       │   └── types.ts             # Shared TS types (server ⇄ extension)
│       └── styles/globals.css       # Tailwind entry + Shadow DOM reset
├── migrations/
│   └── 20260422_add_extension_usage.sql  # DDL applied via MCP
└── src/
    ├── lib/
    │   ├── extension-route.ts       # authRoute variant (Bearer + CORS)
    │   ├── extension-quota.ts       # Anon + free tier daily quota logic
    │   └── summary-prompt.ts        # TS mirror of worker/gemini_api.py prompt
    └── types/supabase.ts            # Regenerated to include new tables
```

## Freemium model (aligned with the web app)

| Tier | Daily summaries | Languages | Audio TTS | Comments TLDR | Card required |
|---|---|---|---|---|---|
| **Anonymous** (no account) | 3 | Source only | ❌ | ❌ | Never |
| **Free signed-in** | 10 | EN / FR / ES | ❌ | ❌ | Never |
| **Pro / Trial** | ∞ | 15+ | ✅ | ✅ | At Checkout |

Enforcement is done in `src/lib/extension-quota.ts` via two RPCs:

- `increment_extension_anon_usage(device_id, video_id, user_agent, ip)` — atomic UPSERT on `extension_anon_usage`.
- `increment_extension_user_usage(user_id)` — atomic UPSERT on `extension_user_usage`.

The device identifier is a nanoid generated on first run and stored in `chrome.storage.local`. Browsing privately or reinstalling the extension resets it — intentional, because we never want anonymous tracking to feel invasive. If abuse picks up, layer a CAPTCHA on `/api/extension/summarize` for anonymous calls; don't tighten fingerprinting.

## Request flows

### Happy path — video has captions

```
1. yt-navigate-finish fires (YouTube SPA)
2. Content script → extractVideoMeta() reads window.ytInitialPlayerResponse
3. Content script → pickBestCaptionTrack() chooses the best track
   (prefers user preferred_language, manual > ASR)
4. Content script → fetchTranscript() GETs the track.baseUrl with
   credentials: "include" — uses the user's YouTube cookies, not ours
5. Content script auto-triggers SUMMARIZE (no button click needed)
6. Background SW → POST /api/extension/summarize
7. Server → quota check → cache lookup on processed_videos → Gemini Flash call
8. Server → write back to processed_videos (so the web feed shares the result)
9. Server → increment usage counter → return { summary, chapters }
10. Sidebar renders within ~2-3 seconds
```

### Fallback — no captions / rate-limited / auto-generated low-quality

```
1. Content script detects track == null OR asks user for full transcription
2. User clicks "Transcribe & summarize" (requires sign-in — worker costs money)
3. Background SW → POST /api/extension/enqueue
4. Server → queueVideoForProcessing() with priority=100 (user-initiated)
5. Worker picks up via pick_next_processing_job() RPC:
   a. transcript_extractor.py runs YouTube API → Invidious → Piped → yt-dlp → Whisper
   b. gemini_api.py summarizes
   c. (Pro users only) tts_processor.py renders audio
6. Content script polls GET /api/extension/status/:videoId every 3 s
7. On status=completed, sidebar renders the summary and audio (if Pro)
```

## Auth: how the extension reaches an authenticated state

Chrome extensions can't share cookies with arbitrary third-party domains, and we intentionally don't bake the Supabase URL + anon key into the distributable (smaller threat surface, easier rotation). The pattern we use:

1. **User clicks Sign in** in the popup → `SIGN_IN` message.
2. Background SW calls `chrome.identity.launchWebAuthFlow` with URL `https://www.brief-tube.com/extension/auth?ext_id=<id>&redirect_uri=<chromiumapp.org_callback>&state=<random>`.
3. `app/extension/auth/page.tsx` is a Server Component. If the user already has an active Supabase session, it hands the session to the client component `ExtensionAuthBridge`. Otherwise it redirects to `/login?next=/extension/auth?…`.
4. `ExtensionAuthBridge` (client) builds a URL like `<redirect_uri>#access_token=…&refresh_token=…&expires_at=…&state=…` and navigates to it.
5. `chrome.identity.launchWebAuthFlow` intercepts that navigation and hands the full URL back to the background SW.
6. Background SW parses the hash, stores `{accessToken, refreshToken, expiresAt}` in `chrome.storage.local`, and all subsequent API calls include `Authorization: Bearer <accessToken>`.

The callback HTML at `extension/src/auth/callback.html` is a courtesy fallback: if somehow the page loads in a normal tab (launchWebAuthFlow failed), the inline script calls `window.close()`.

**Refresh caveat** — `src/lib/api.ts` has a `refreshSession()` stub that currently returns `null`, which clears the session and forces a re-login. Token lifespan is 1 h on Supabase by default. Either (a) add a `/api/extension/auth/refresh` endpoint that accepts the refresh token and returns a fresh access token, or (b) bundle the anon key into the extension and call `supabase.auth.refreshSession()` directly. Option (a) is cleaner — see "Extension roadmap" below.

## Server endpoints

All live under `/api/extension/` and use the `extensionRoute` wrapper from `src/lib/extension-route.ts`. The wrapper:

- Resolves the user from `Authorization: Bearer <jwt>` header, falling back to cookies.
- Sets permissive CORS headers — needed because extension origins look like `chrome-extension://<id>/`, which the browser sends on `fetch` from the content script/background SW.
- Provides `corsPreflight` for `OPTIONS` requests.

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/extension/me` | GET | Optional | Returns `{authenticated, user, quota}`. Also flips `profiles.extension_installed_at` on first hit. |
| `/api/extension/summarize` | POST | Optional | Happy path. Body: `{videoId, transcript, sourceLanguage, …}`. Returns the summary plus a `cached` flag. |
| `/api/extension/enqueue` | POST | Required | Fallback. Calls `queueVideoForProcessing` with priority=100 so the user's request jumps the worker queue. |
| `/api/extension/status/[videoId]` | GET | Optional | Polling endpoint for the fallback flow. `?lang=<code>` disambiguates the stored row. |
| `/api/extension/subscribe-channel` | POST | Required | Adds a row to `subscriptions` with `source_type='extension'`. Enforces the plan's `max_channels` limit. |

Rate limits (Upstash Redis, `src/lib/rate-limit.ts`):

- `publicRateLimit` (3 req / 10 min / IP) for anonymous `/summarize` calls.
- `authRateLimit` (30 / min / user) for authenticated `/summarize`, `/enqueue`, `/subscribe-channel`.
- `heavyRateLimit` (5 / min / user) is not used here — quota caps already bound spend.

## Database changes

Migration: `migrations/20260422_add_extension_usage.sql` (already applied to production via the Supabase MCP, so running it again is a no-op thanks to `IF NOT EXISTS`).

```sql
-- extension_anon_usage (device_id PK, usage_date PK)
--   Daily summary count per device fingerprint. Service role writes only.
-- extension_user_usage (user_id PK, usage_date PK)
--   Daily summary count per authenticated free user. Service role writes,
--   authenticated user SELECT on own row.
-- profiles.extension_installed_at  timestamptz
--   Telemetry. Flipped on first /api/extension/me hit for signed-in users.
-- increment_extension_anon_usage(device_id, video_id, user_agent, ip) → int
-- increment_extension_user_usage(user_id)                               → int
--   Atomic UPSERT-and-return-new-count. Never call raw INSERTs from Node;
--   the RPC guarantees no double-counting under concurrent requests.
```

**Do not** add a per-video dedup in the anon table — if the user watches the same video from two devices, counting them separately is correct.

## Dev workflow

```bash
# One-time
cd extension
pnpm install

# Iterate
pnpm dev                    # watches, rebuilds into dist/
# then load dist/ unpacked in chrome://extensions

# Ship
pnpm build                  # tsc --noEmit + vite build → dist/
# then zip dist/ and upload to Chrome Web Store
```

The extension is a **separate package** from the Next.js app. It has its own `node_modules`, its own `tsconfig`, and is excluded from the root `tsconfig.json` (`exclude: [..., "extension"]`) and the root ESLint config (`ignores: [..., "extension/"]`) to avoid cross-contamination — the extension runs on Chrome-only globals (`chrome.*`, Shadow DOM APIs) that would pollute the server project.

### Local testing against `localhost:3000`

Edit `extension/src/lib/config.ts`:

```ts
export const BRIEFTUBE_CONFIG = {
  apiBase: "http://localhost:3000",
  authBase: "http://localhost:3000",
  extensionVersion: chrome.runtime.getManifest().version,
};
```

Then rebuild. The extension also needs `host_permissions` for `http://localhost/*` in `manifest.json` for local work — don't ship that in the release build.

## Known limitations / TODO

- **Refresh flow is stubbed.** Expired access tokens drop the session and require a new `launchWebAuthFlow`. Fix by adding a `/api/extension/auth/refresh` that swaps refresh→access server-side.
- **Chapters are heuristic.** The `ChaptersPanel` currently chunks the transcript evenly across time. The `buildChaptersPrompt` helper in `src/lib/summary-prompt.ts` exists for a future endpoint that asks Gemini for structured chapter output — wire `/api/extension/chapters/[videoId]` to use it.
- **Comments TLDR is a placeholder.** Plumb the YouTube Data API (`commentThreads.list`) into a new endpoint, gated on Pro.
- **Audio tab is a placeholder.** When a user who's Pro summarizes, persist the audio URL on `processed_videos.audio_url` (already a column), and surface a `<audio>` player in the tab.
- **Firefox/Edge** — MV3 is near-compatible but `chrome.identity.launchWebAuthFlow` has Firefox quirks (redirect must be `moz-extension://`). Left out of scope.

## Deploying a new version

1. Bump `extension/manifest.json:version` and `extension/package.json:version` (must match).
2. `cd extension && pnpm build`.
3. Zip `dist/`: `cd dist && zip -r ../brieftube-extension-<version>.zip .`
4. Upload to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
5. The backend endpoints are deployed with the regular web app (`/api/extension/*` ships via the Next.js build on push to `main`).

## Responding to the Eightify complaint pattern

When writing the Chrome Web Store listing or replying to reviews, lean into these differentiators — they're the direct flip of every common 1★ review on Eightify's listing:

| User said about Eightify | BriefTube listing answer |
|---|---|
| "Asks for card before you can see anything." | "Three summaries per day with no account, no card — ever." |
| "Only 1 free per day." | "Up to 10 per day free once you sign in with Google." |
| "Can't cancel, support ignored me." | "One-click cancel straight to Stripe Customer Portal from the popup." |
| "Doesn't even work without captions." | "Falls back to Whisper for videos with no subtitles." |
| "Timestamps are scrambled." | "Chapters always in chronological order (not by topic)." |
| "Just a reskin of ChatGPT — I'll do it myself." | "One click inline, synced to a cross-device dashboard, with audio and channel subscriptions — no prompt engineering needed." |

Write the Chrome Web Store description in the same voice. Mentioning the paid tier explicitly in the description (not buried in the install flow) is the single biggest lever — every hidden-paywall complaint on Eightify stems from the opposite choice.
