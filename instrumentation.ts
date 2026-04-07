// Sentry server-side init disabled — Next.js 16.2 + Turbopack standalone
// builds bundle @opentelemetry/api, require-in-the-middle and friends with
// content-hashed external module names that fail to resolve at runtime:
//   "Cannot find module '@opentelemetry/api-2543c6b61b192f2f'"
// (verified on 2026-04-07: even with serverExternalPackages set in
// next.config.ts, Turbopack still rewrites the require path with a hash).
//
// We intentionally avoid loading sentry.server.config / sentry.edge.config
// here. Client-side Sentry continues to work via instrumentation-client.ts
// (browser bundle is unaffected). If you need server error reporting later,
// migrate to @sentry/node directly or wait for the Turbopack fix to land.

export async function register() {
  // Intentionally empty.
}
