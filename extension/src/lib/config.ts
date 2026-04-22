/**
 * The extension ships for production by default (www.brief-tube.com).
 * During local development, flip DEV_MODE to true and rebuild to point the
 * extension at http://localhost:3000. The matching manifest host permissions
 * and content-script match patterns are declared for both origins, so the
 * same build can reach either one — only the base URL changes.
 */
const DEV_MODE = true;

export const BRIEFTUBE_CONFIG = {
  apiBase: DEV_MODE ? "http://localhost:3000" : "https://www.brief-tube.com",
  authBase: DEV_MODE ? "http://localhost:3000" : "https://www.brief-tube.com",
  extensionVersion: chrome.runtime.getManifest().version,
};

/**
 * All origins the extension is allowed to talk to. Used by the auth content
 * script to match both production and localhost.
 */
export const AUTH_MATCH_PATTERNS = [
  "https://www.brief-tube.com/extension/auth*",
  "https://brief-tube.com/extension/auth*",
  "http://localhost/extension/auth*",
  "http://127.0.0.1/extension/auth*",
];

export const STORAGE_KEYS = {
  deviceId: "brieftube_device_id",
  session: "brieftube_session",
  preferences: "brieftube_prefs",
  lastMeCache: "brieftube_me_cache",
} as const;
