/**
 * The extension ships for production by default (www.brief-tube.com).
 *
 * DEV_MODE is automatically disabled when Vite is built with
 * `BRIEFTUBE_PROD=1` or `NODE_ENV=production` (see `vite.config.ts`), which
 * also swaps in `manifest.prod.json`. Locally (`pnpm dev` / `pnpm build`) it
 * stays enabled so the extension points at http://localhost:3000. The matching
 * manifest host permissions and content-script match patterns are declared for
 * both origins in the dev manifest, so the same dev build can reach either one
 * — only the base URL changes.
 */
const DEV_MODE = import.meta.env.BRIEFTUBE_PROD !== "1";

export const BRIEFTUBE_CONFIG = {
  apiBase: DEV_MODE ? "http://localhost:3000" : "https://www.brief-tube.com",
  authBase: DEV_MODE ? "http://localhost:3000" : "https://www.brief-tube.com",
  extensionVersion: chrome.runtime.getManifest().version,
};

/**
 * All origins the extension is allowed to talk to. Used by the auth content
 * script to match both production and localhost.
 */
export const AUTH_MATCH_PATTERNS = DEV_MODE
  ? [
      "https://www.brief-tube.com/extension/auth*",
      "https://brief-tube.com/extension/auth*",
      "http://localhost/extension/auth*",
      "http://127.0.0.1/extension/auth*",
    ]
  : [
      "https://www.brief-tube.com/extension/auth*",
      "https://brief-tube.com/extension/auth*",
    ];

export const STORAGE_KEYS = {
  session: "brieftube_session",
  preferences: "brieftube_prefs",
  lastMeCache: "brieftube_me_cache",
} as const;
