"use client";

import NextError from "next/error";
import { useEffect } from "react";
import { logger } from "@/lib/logger";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    // NOTE: Sentry.captureException intentionally removed, see
    // instrumentation.ts comment block for the Turbopack hash bug context.
    // Sentry's auto-instrumented browser handlers (loaded by
    // instrumentation-client.ts) still capture global errors via
    // window.onerror / unhandledrejection, so this error is still reported.
    logger.error("[GlobalError]", error);
  }, [error]);

  return (
    <html>
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
