import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://c852a9022aaf9dccc1ae7520f19c656e@o4510697179709440.ingest.de.sentry.io/4510697223684176",
  sendDefaultPii: true,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  includeLocalVariables: true,
});
