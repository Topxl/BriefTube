declare global {
  var gtag: (command: string, ...args: unknown[]) => void;
}

const GOOGLE_ADS_ID = "AW-17972477350";

/**
 * Fire a Google Ads conversion event on the "Abonnement (1)" action.
 *
 * Requires NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL to be set in Vercel env vars
 * (Production + Preview). Since NEXT_PUBLIC_* is inlined at build time, adding or
 * changing this var requires a redeploy to take effect.
 *
 * How to find the label: Google Ads → Goals → Conversions → "Abonnement (1)" →
 * Tag setup → Install tag yourself → copy the string after `AW-17972477350/`
 * in the `send_to` line (currently `tfEHCM2EqP4bEKb7-PlC`, 2026-04-08).
 *
 * Optionally accepts user data for Enhanced Conversions for Web (improves match
 * rate by ~5-15%). Pass a plain email — gtag hashes it automatically.
 */
export function trackAdConversion(userData?: { email?: string }) {
  if (typeof window === "undefined") return;

  const label = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL;
  if (!label) {
    // eslint-disable-next-line no-console
    console.error(
      "[gtag] NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL is not set — Google Ads conversion NOT sent. " +
        "Add the env var in Vercel (Production) and redeploy. See src/lib/gtag.ts JSDoc for instructions.",
    );
    return;
  }
  if (typeof globalThis.gtag === "undefined") {
    // eslint-disable-next-line no-console
    console.error(
      "[gtag] gtag is not loaded — Google Ads conversion NOT sent. " +
        "Check that app/layout.tsx still injects the googletagmanager script and that an ad-blocker isn't blocking it.",
    );
    return;
  }

  if (userData?.email) {
    globalThis.gtag("set", "user_data", { email: userData.email });
  }

  globalThis.gtag("event", "conversion", {
    send_to: `${GOOGLE_ADS_ID}/${label}`,
  });

  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.info(
      `[gtag] Google Ads conversion sent: ${GOOGLE_ADS_ID}/${label}`,
      userData?.email ? "(with enhanced conversions)" : "",
    );
  }
}
