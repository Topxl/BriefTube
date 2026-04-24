/* eslint-disable @typescript-eslint/no-explicit-any */
import type { EventHint } from "@sentry/nextjs";

/**
 * Scrub sensitive tokens and headers from Sentry events.
 * Replaces JWT tokens, Bearer tokens, and Supabase auth tokens with placeholders.
 */
function scrubString(s: string): string {
  return s
    .replace(/\b(eyJ[A-Za-z0-9_-]{20,})/g, "[JWT]")
    .replace(/\b(sb-[a-z0-9-]+-auth-token)=[^;\s]+/g, "$1=[Filtered]")
    .replace(/\bBearer\s+[A-Za-z0-9._-]+/g, "Bearer [Filtered]");
}

/**
 * beforeSend hook that filters cookies, headers, and scrubs token patterns
 * from Sentry events before transmission.
 */
export function createBeforeSendHook() {
  return (event: any, _hint?: EventHint) => {
    if (!event) return null;

    // Strip request cookies
    if (event.request) {
      if (event.request.cookies) {
        event.request.cookies = { "[Filtered]": "" };
      }
      // Strip sensitive headers
      if (event.request.headers) {
        const sensitiveKeys = [
          "authorization",
          "cookie",
          "set-cookie",
          "x-api-key",
          "x-supabase-auth",
        ];
        for (const key of Object.keys(event.request.headers)) {
          if (sensitiveKeys.includes(key.toLowerCase())) {
            event.request.headers[key] = "[Filtered]";
          }
        }
      }
    }

    // Scrub message and breadcrumb messages
    if (event.message) {
      event.message = scrubString(event.message);
    }

    // Scrub breadcrumbs
    if (event.breadcrumbs) {
      for (const breadcrumb of event.breadcrumbs) {
        if (breadcrumb.message) {
          breadcrumb.message = scrubString(breadcrumb.message);
        }
        if (breadcrumb.data) {
          const data = breadcrumb.data as Record<string, unknown>;
          for (const [key, value] of Object.entries(data)) {
            if (
              typeof value === "string" &&
              ["url", "query", "body", "response"].includes(key)
            ) {
              data[key] = scrubString(value);
            }
          }
        }
      }
    }

    return event;
  };
}
