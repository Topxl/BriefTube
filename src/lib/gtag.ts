declare global {
   
  var gtag: (command: string, ...args: unknown[]) => void;
}

const GOOGLE_ADS_ID = "AW-17972477350";

/**
 * Fire a Google Ads conversion event.
 * Requires NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL to be set.
 * Silently skips if gtag is not loaded or label is missing.
 */
export function trackAdConversion() {
  const label = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL;
  if (typeof window === "undefined") return;
  if (typeof globalThis.gtag === "undefined") return;
  if (!label) return;
  globalThis.gtag("event", "conversion", {
    send_to: `${GOOGLE_ADS_ID}/${label}`,
  });
}
