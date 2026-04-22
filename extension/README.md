# BriefTube Chrome extension: dev guide

> **Full architecture + rationale**: see `../EXTENSION.md` at the repo root.
> This file is the short dev-loop cheat sheet.

## Install

```bash
pnpm install
```

## Develop

```bash
pnpm dev
```

Loads a watcher into `dist/`. Load it as an unpacked extension:

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**, pick `extension/dist`

Edits to `src/` hot-reload. If manifest/config changes don't pick up, hit the ↻ refresh button on the extension card in `chrome://extensions`.

## Build for Chrome Web Store

```bash
pnpm build
cd dist && zip -r ../brieftube-extension.zip . && cd ..
```

Upload `brieftube-extension.zip` to the [CWS dashboard](https://chrome.google.com/webstore/devconsole).

## Point to localhost during dev

Edit `src/lib/config.ts` → set `apiBase: "http://localhost:3000"`. Don't commit that.

## File overview

- `manifest.json`: MV3 manifest (permissions, content scripts, SW).
- `src/content/`: everything that runs on `youtube.com/watch`.
  - `transcript.ts`: extract `ytInitialPlayerResponse`, pick caption track, fetch transcript.
  - `sidebar.tsx`: React UI injected in a Shadow DOM, `z-index: 2147483647`.
  - `index.tsx`: mount + SPA navigation watcher.
- `src/background/index.ts`: message broker + `chrome.identity.launchWebAuthFlow`.
- `src/popup/`: toolbar popup (quota + sign-in).
- `src/auth/callback.html`: landing for the OAuth redirect fallback.
- `src/lib/api.ts`: fetch wrapper, adds `Authorization: Bearer <jwt>` when signed in.
- `src/lib/storage.ts`: `chrome.storage.local` helpers (`device_id`, `session`, prefs).

## Why the "Subscribe channel" button matters

It's the single feature Eightify doesn't have. Every subscription added from the extension pipes future uploads through the BriefTube worker → Telegram / Discord / email, converting a casual extension user into a long-tail BriefTube customer without them ever visiting the web app. Don't remove it without thinking hard.

## Troubleshooting

- **Build fails with `browserslist: contains both .browserslistrc and package.json with browsers`**: the repo root has both. A local `.browserslistrc` in `extension/` shadows them; don't delete it.
- **Rollup can't resolve `@/…`**: alias is declared in `vite.config.ts`. If you add a new entry point in `rollupOptions.input`, keep the alias.
- **Sidebar renders but styles are naked**: the Shadow DOM imports globals via `?inline-css`. Don't move `globals.css` without updating `src/content/index.tsx`.
- **OAuth redirects but tokens don't arrive**: check that `redirect_uri` handed to `launchWebAuthFlow` matches `chrome.runtime.getURL("src/auth/callback.html")` exactly. A trailing slash mismatch silently breaks it.
