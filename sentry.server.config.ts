import * as Sentry from "@sentry/nextjs";
import { createBeforeSendHook } from "@/lib/sentry/scrub";

// Opt-in only: without a DSN, Sentry stays off. See instrumentation-client.ts.
const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
    includeLocalVariables: false,
    beforeSend: createBeforeSendHook(),
  });
}
