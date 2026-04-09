declare global {
  var gtag: (command: string, ...args: unknown[]) => void;
}

const GOOGLE_ADS_ID = "AW-17972477350";

type TrackAdConversionParams = {
  /** User email for Enhanced Conversions for Web (gtag hashes it). +5-15% match rate. */
  email?: string;
  /** Monetary value of the conversion in `currency` units (e.g. 5 for $5.00). Enables Target ROAS. */
  value?: number;
  /** ISO 4217 currency code (e.g. "USD"). Required when `value` is set. */
  currency?: string;
  /** Unique ID to deduplicate conversions if the event fires twice (e.g. Stripe subscription ID). */
  transactionId?: string;
};

/**
 * Fire a Google Ads conversion event on the "Abonnement (1)" action.
 *
 * Requires NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL to be set in Infisical `/web` prod
 * (synced to the VPS build environment). Since NEXT_PUBLIC_* is inlined at build time,
 * changing this var requires a redeploy to take effect.
 *
 * How to find the label: Google Ads → Goals → Conversions → "Abonnement (1)" →
 * Tag setup → Install tag yourself → copy the string after `AW-17972477350/`
 * in the `send_to` line (currently `tfEHCM2EqP4bEKb7-PlC`, 2026-04-08).
 *
 * Pass `value` + `currency` whenever you know the real transaction amount — it
 * unlocks value-based bidding strategies (Target ROAS, Maximize Conversion Value).
 * Pass `transactionId` to prevent double-counting if the component re-mounts.
 */
export function trackAdConversion(params: TrackAdConversionParams = {}) {
  if (typeof window === "undefined") return;

  const label = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL;
  if (!label) {
    // eslint-disable-next-line no-console
    console.error(
      "[gtag] NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL is not set — Google Ads conversion NOT sent. " +
        "Add the env var in Infisical (/web prod) and redeploy. See src/lib/gtag.ts JSDoc for instructions.",
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

  if (params.email) {
    globalThis.gtag("set", "user_data", { email: params.email });
  }

  const eventPayload: Record<string, unknown> = {
    send_to: `${GOOGLE_ADS_ID}/${label}`,
  };
  if (typeof params.value === "number" && params.currency) {
    eventPayload.value = params.value;
    eventPayload.currency = params.currency;
  }
  if (params.transactionId) {
    eventPayload.transaction_id = params.transactionId;
  }

  globalThis.gtag("event", "conversion", eventPayload);

  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.info(
      `[gtag] Google Ads conversion sent: ${GOOGLE_ADS_ID}/${label}`,
      eventPayload,
    );
  }
}
