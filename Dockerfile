# syntax=docker/dockerfile:1
################################################################################
# BriefTube — web app (Next.js 16, App Router)
#
# Multi-stage build producing the `output: "standalone"` server declared in
# next.config.ts. The final image ships only the traced runtime, not the repo.
#
# Base image: node:24-bookworm-slim
#   - Node 24 matches .nvmrc (v24.8.0).
#   - Debian (glibc), not Alpine (musl): `next build --turbo` writes native
#     binaries (@next/swc, sharp) into .next/standalone/node_modules, so the
#     builder and the runner must agree on the libc. Mixing them yields a
#     "Failed to load native binding" crash at boot.
#
# Build:  docker compose build web
# Run:    docker compose up -d
################################################################################

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# package.json pins `packageManager: pnpm@10.14.0` — corepack honours that pin.
RUN corepack enable

# --- deps ---------------------------------------------------------------------
# Dependencies only, so this layer is reused as long as the lockfile is stable.
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
# --ignore-scripts: the root `postinstall` runs `next typegen .`, which needs the
# app/ and src/ sources that are deliberately absent from this layer.
# `next build` regenerates .next/types itself, so nothing is lost.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

# --- builder ------------------------------------------------------------------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* values are inlined into the browser bundle at build time, so they
# must be present HERE, not only at runtime. docker-compose.yml forwards them
# from .env through `build.args`. Changing one requires a rebuild:
#   docker compose up -d --build web
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_EMAIL_CONTACT
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_EMAIL_CONTACT=$NEXT_PUBLIC_EMAIL_CONTACT \
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY \
    NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY \
    NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST

# src/lib/env.ts (@t3-oss/env-nextjs) marks the Stripe and Google OAuth keys as
# required. A self-hosted instance runs fine without billing, so validation is
# skipped by default. Set SKIP_ENV_VALIDATION=false to enforce the full schema.
ARG SKIP_ENV_VALIDATION=true
ENV SKIP_ENV_VALIDATION=$SKIP_ENV_VALIDATION

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# app/sitemap.tsx is prerendered at build time and calls createAdminClient(),
# which throws when SUPABASE_SERVICE_ROLE_KEY is absent. The key travels as a
# BuildKit secret (docker-compose.yml sources it from .env) so it never lands in
# an image layer. Without it the build still succeeds — the sitemap simply lists
# the static routes only, since failed Supabase queries return an empty result.
RUN --mount=type=secret,id=supabase_service_role_key,required=false \
    SUPABASE_SERVICE_ROLE_KEY="$(cat /run/secrets/supabase_service_role_key 2>/dev/null || echo build-time-placeholder)" \
    pnpm build

# --- runner -------------------------------------------------------------------
FROM node:24-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Bind to every interface so the port publish in docker-compose.yml reaches it.
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

# public/ and .next/static/ are not part of the standalone trace — copy them by
# hand, exactly as the Next.js standalone docs prescribe.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# src/lib/letters/data-collector.ts reads CHANGELOG.md from process.cwd() at
# runtime. Missing, it degrades gracefully — present, the weekly letter works.
COPY --from=builder --chown=nextjs:nodejs /app/CHANGELOG.md ./CHANGELOG.md

USER nextjs
EXPOSE 3000

# Node 24 ships a global fetch, so no curl is needed in the runtime image.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
