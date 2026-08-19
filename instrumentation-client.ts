import * as Sentry from "@sentry/nextjs";

// Self-hosters get no error reporting unless they bring their own Sentry project.
// The DSN used to be hardcoded here, which quietly shipped every self-hosted
// instance's errors to the upstream maintainer's account.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    sendDefaultPii: true,
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,
    integrations: [Sentry.replayIntegration()],
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
