import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://c852a9022aaf9dccc1ae7520f19c656e@o4510697179709440.ingest.de.sentry.io/4510697223684176",
  sendDefaultPii: true,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,
  integrations: [],
});

// Lazy-load Replay after page is interactive to reduce initial JS bundle
if (typeof window !== "undefined") {
  window.addEventListener(
    "load",
    () => {
      setTimeout(() => {
        void Sentry.lazyLoadIntegration("replayIntegration").then((replay) => {
          Sentry.addIntegration(replay());
        });
      }, 3000);
    },
    { once: true },
  );
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
