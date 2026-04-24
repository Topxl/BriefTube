import * as Sentry from "@sentry/nextjs";
import { createBeforeSendHook } from "@/lib/sentry/scrub";

Sentry.init({
  dsn: "https://c852a9022aaf9dccc1ae7520f19c656e@o4510697179709440.ingest.de.sentry.io/4510697223684176",
  sendDefaultPii: false,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  includeLocalVariables: false,
  beforeSend: createBeforeSendHook(),
});
