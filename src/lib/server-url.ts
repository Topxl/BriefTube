/**
 * Returns the base URL for the current environment.
 * Works in both client and server contexts.
 */
export const getBaseUrl = (request?: Request): string => {
  // Client-side: use window origin
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  // Test environment
  if (process.env.PLAYWRIGHT_TEST_BASE_URL) {
    return process.env.PLAYWRIGHT_TEST_BASE_URL;
  }

  // Development: use request origin if available, otherwise localhost
  if (process.env.NODE_ENV === "development") {
    if (request) {
      return new URL(request.url).origin;
    }
    return `http://localhost:${process.env.PORT ?? 3000}`;
  }

  // Production: use configured site URL
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.brief-tube.com";
};

/** @deprecated Use getBaseUrl instead */
export const getServerUrl = getBaseUrl;
