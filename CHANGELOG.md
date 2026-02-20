# Changelog

## 2026-02-20

FIX: Add suppressHydrationWarning to all form and input elements to suppress Dashlane hydration mismatch
UX: Improve Input component visibility — bg-white/[0.06] background, border-white/[0.14], better focus ring
FIX: Add data-form-type="other" to YouTube channel input to prevent Dashlane autofill
UX: Limit sources list to 3 visible by default with search bar + "Show more" (+10) navigation

FIX: Fix security advisor — remove SECURITY DEFINER from transcript_cost_analytics view
FIX: Fix security advisor — add SET search_path to generate_referral_code, pick_next_processing_job, prevent_sensitive_profile_changes
CHORE: Fix all RLS performance advisors — replace auth.uid() with (select auth.uid()) across 13 policies
CHORE: Add 6 missing FK indexes (channel_lists, list_follows, list_stars, profiles, referrals, subscriptions)
CHORE: Drop 2 unused indexes (idx_processed_videos_retry, idx_processed_videos_cost)
CHORE: Split list_channels "list owner write" ALL policy into INSERT/UPDATE/DELETE to eliminate multiple permissive SELECT policies
CHORE: Run code-quality CI on push to main (was pull_request only)
CHORE: Remove debug console.log from auth/callback route (production issue resolved)
FIX: Use NEXT_PUBLIC_SITE_URL in OAuth redirectTo to avoid www vs non-www mismatch
FIX: Update prodUrl in site-config to https://www.brief-tube.com

CHORE: Delete apply_migration.py (one-off script that admitted it couldn't execute DDL)
REFACTOR: Remove summarize_with_retry() from gemini_api.py — dead code never called by main.py
REFACTOR: Remove video_url param from GeminiSummarizer.summarize() — was accepted but deliberately ignored; intent now documented in docstring
REFACTOR: Compile 14 regex patterns at module level in text_cleaner.py instead of per call
REFACTOR: Remove __main__ blocks from gemini_api.py, text_cleaner.py, whisper_transcriber.py
FIX: Move import time / import shutil to module level (were inline in hot paths / finally blocks)
FIX: Replace deprecated datetime.utcnow() with datetime.now(timezone.utc) in monitoring.py (×2)
FIX: Remove 3 dead config vars (COOKIES_FILE, BROWSER_PROFILE_DIR, YOUTUBE_PROXY_HTTPS) left over from deleted gemini_browser.py
REFACTOR: Consolidate Telegram alert logic — move MonitoringAlert and send_daily_report from monitoring.py to bot_handler.py; monitoring.py is now a pure data/stats module with zero Telegram dependencies
CHORE: Move 6 test_*.py scripts from worker root to worker/tests/ — add sys.path fix so they still run from the subdirectory
FIX: transcript_extractor.py missing `import re` at module level — _parse_vtt() silently failed (NameError swallowed by try/except), returning subtitle text with raw HTML tags to Gemini
FIX: _get_api() called once per language attempt (up to 12x per video) — now called once per get_transcript() call, reused across language loop
FIX: Bot() singleton in telegram_deliverer — was creating a new HTTPS connection pool on every delivery call
FIX: fail_job() now syncs processed_videos to "failed" when job permanently fails after 3 attempts — prevents videos staying stuck as "pending" forever
FIX: pick_next_job() now uses atomic PostgreSQL RPC with FOR UPDATE SKIP LOCKED — eliminates race condition between rapid restarts or concurrent workers
FIX: import re and import aiohttp moved to module level in main.py (were inline in hot paths)
CHORE: delete gemini_browser.py (dead code, replaced by gemini_api.py)

FIX: RSS scanner loaded only 1000 of 4000+ known video IDs (PostgREST limit) — paginate get_all_known_video_ids() so the full set is always loaded; scanner no longer treats old videos as new
FIX: insert_new_video and enqueue_video upserts without ignore_duplicates overwrote skipped/completed videos back to pending — added ignore_duplicates=True to both

FIX: Worker Supabase HTTP/2 instability — disabled HTTP/2 in httpx client (h2 was installed, Supabase/Cloudflare sent GOAWAY frames causing constant ConnectionTerminated errors that blocked all deliveries since restart)
FIX: Worker multiple instances — two worker instances were running simultaneously causing race conditions; switched start/stop/restart scripts to use systemctl exclusively
CHORE: Worker systemd service — corrected path in brieftube-worker.service (Bureau/BriefTube → Bureau/Projets/BriefTube), changed Restart=always to Restart=on-failure, enabled and activated service

FIX: Scheduled/upcoming videos (Premieres) — RSS scanner now checks entry.published_parsed and skips videos with a future publish date; they're picked up naturally on the next scan once live; video_unavailable added to should_retry() so edge cases are retried instead of permanently failed

FIX: Video processing timeout — VIDEO_TIMEOUT (600s) was defined but never applied; wrap _process_video with asyncio.wait_for so a hung job can't block a semaphore slot forever

FIX: db.single() crash — mark_video_failed() and fail_job() used .single().execute() which throws if the row is missing (e.g. deleted between pick and fail); replaced with .execute() + explicit row check

FIX: Groq 429 permanently fails videos — should_retry() returned False for "whisper_error: 429" so videos hit Groq quota limit were marked failed permanently; now retries after midnight UTC quota reset

FIX: RSS scanner — was making 3375 individual DB queries per scan (225 channels × 15 videos × is_video_processed); replaced with a single get_all_known_video_ids() call that loads all IDs into a Python set; reduces Supabase load by 99% and eliminates Server disconnected errors during scans

FIX: Worker systemd services — brieftube-worker and brieftube-logbot now managed by systemd user services; guaranteed single instance, auto-restart on crash, starts at session login

FEATURE: SectionErrorBoundary — React class error boundary for dashboard sections; wraps SourcesSection and SummariesFeed so a section crash no longer blanks the full page
FEATURE: fetchApi + isApiError — typed fetch wrapper in src/lib/api-response.ts that throws on non-2xx or { error } bodies; unifies client-side API error handling
REFACTOR: resolveActionResult — now resolves ActionResult<T> discriminated union and throws on { error }; exports ActionResult, ActionSuccess, ActionFailure types
CHORE: Add type:supabase script to package.json — regenerate src/types/supabase.ts from local DB schema with one command

FIX: YouTube transcript IP block — configure WebshareProxyConfig (rotating residential) via YOUTUBE_PROXY_HTTP; uses native youtube-transcript-api WebshareProxyConfig with 10 auto-retries on block; transcripts now free again via YouTube API

FEATURE: yt-dlp subtitle fallback — 3-step transcript pipeline: (1) youtube-transcript-api, (2) yt-dlp VTT download with cookies/proxy (free, bypasses API IP block), (3) Groq Whisper; add deno to PATH at startup for yt-dlp JS runtime

FEATURE: E2E tests — auth redirects, onboarding wizard, dashboard channels (Playwright + Supabase magic link auth helper)

FEATURE: YouTube cookies support — place cookies/youtube.txt (Netscape format) to bypass IP blocks on transcript API; transcript_extractor auto-loads them if present; startup log indicates cookie status

FEATURE: Groq quota tracking — WorkerStats now tracks seconds/cost used today with daily reset; proactive Telegram alerts when IP is blocked (once/day), when quota reaches 80%, and when rate limit 429 is hit (with quota info)

FEATURE: Log bot Groq dashboard — Stats view now shows daily Groq cost, audio minutes, transcriptions, quota bar (🟢/🟡/🔴), rate limit hits, and IP block count parsed from worker.log

## 2026-02-19

CHORE: Best practices — env validation (required vars crash at startup), select specific columns on profiles, cancel_url → /dashboard/profile, SiteConfig template data cleaned, DB search_path hardened on 4 functions, processing_queue RLS policy added, transcript_cost_analytics SECURITY DEFINER removed


FIX: Transcript extractor — fallback "any language" call used no language spec, defaulting to English; French videos with FR transcripts were falling back to Whisper unnecessarily, burning Groq quota; now passes preferred_languages to the fallback call

FIX: Old videos backlog — cleared 2019 pending deliveries and 1933 queued jobs from pre-subscription era; deleted 3 orphan accounts (the maintainer's account, user-v***@gmail.com, user-c***@gmail.com) and their data via CASCADE

FEATURE: Referral system — referral_code on profiles, referrals table, 30-day cookie tracking, reward on Stripe checkout (20% monthly / 1 free month annual), ReferralSection on profile page, ShareListButton on list pages

FIX: Trial users can now upgrade to paid Pro — show upgrade button when isTrial even though isPro is true
FIX: Checkout preserves remaining trial days — passes trial_end to Stripe so user doesn't lose free days
FIX: DB — handle_new_user trigger changed from 14 days to 7 days trial
REFACTOR: Trial duration moved from DB trigger to SiteConfig.trialDays — change once in site-config.ts, applies everywhere
REFACTOR: SiteConfig.freeChannelsLimit aligned to 3 (was 5 on landing, 2 in DB trigger, 3 as DB default) — all ?? 3 magic numbers replaced
REFACTOR: SiteConfig.defaultTtsVoice added — replaces hardcoded "fr-FR-DeniseNeural" strings in code


REFACTOR: Log bot — remplace l'interface commandes/logs bruts par un dashboard interactif à boutons Telegram : menu principal avec statut worker (🟢/🟡/🔴), stats temps réel Supabase, erreurs reformatées, activité récente, système, et alertes live push (erreurs + succès toutes les 20s via bouton toggle)

FIX: Duplicate Telegram messages — if `send_photo` succeeded but `send_voice` failed, the fallback was sending the voice AGAIN as a separate message (user received photo + separate audio = 2 messages per video); now retries the voice as a reply to the existing photo instead, and returns True to prevent re-delivery next cycle if retry also fails

FIX: Duplicate deliveries on Supabase disconnect — if `mark_delivery_sent` threw after audio was already sent, the delivery stayed "pending" and was re-sent next cycle; now retries with reset_client up to 3 times before giving up

FIX: Duplicate Telegram deliveries — when linking a new account to Telegram, `start_command` now disconnects all other profiles that had the same chat_id before linking the new one; one Telegram = one account maximum

FIX: Delivery queue starvation — `get_pending_deliveries` fetched only the 10 oldest pending rows; if those had non-completed videos they blocked all deliveries forever; fix: fetch 5× more rows and stop after `limit` deliverable ones; also add `cleanup_undeliverable_deliveries()` called every 5 min to auto-discard deliveries for failed videos or disconnected users

FIX: Whisper transcription — support long videos (>50 min) by splitting audio into ≤20 MB chunks with ffmpeg, transcribing each chunk with Groq, then joining results; previously failed with "audio_file_too_large"

REFACTOR: Improve Telegram log bot readability — parse raw log lines into compact `HH:MM LEVEL  message` format with HTML bold/italic for errors/warnings; fix monitoring alerts that used Markdown v1 (`**bold**` was never rendering); switch all three files (log_bot.py, monitoring.py, bot_handler.py) to parse_mode=HTML

FIX: Remove email/password signup — /signup now redirects to /login; all "Start Free" buttons point to /login (Google OAuth only)


REFACTOR: Dashboard navigation — replace Billing nav item with Lists and Profile; update nav to show Dashboard, Lists, Profile; Desktop nav: logo + 3 links + plan badge + avatar circle linking to profile; remove email text and logout from header; move logout to Profile page

FEATURE: Dashboard Lists page — shows followed lists with inline unfollow action, created lists with channel count, and buttons to discover public lists or create new ones

FEATURE: Dashboard Profile page — unified profile section with account info (email, plan, session), Telegram/TTS voice delivery settings, and inline subscription management

FIX: YouTube bulk import — pre-mark all existing videos as "skipped" before inserting subscriptions so the RSS scanner never processes historical videos; only manually added channels trigger the latest-video delivery

FEATURE: Lists edit & delete — page /lists/[id]/edit avec modification nom/description/catégorie/chaînes, suppression de liste avec confirmation, et bouton "Import my subscriptions" sur la page de création pour pré-remplir depuis ses abonnements

FEATURE: Channel Lists — community-driven discovery feature with curated lists of YouTube channels; public discovery at /lists, list detail page, create page, star/follow actions, ghost subscription architecture (Pro/trial only), ListsSection in dashboard, and "Browse channel lists" link in onboarding wizard

FIX: Landing — replace all hardcoded "5 channels" with SiteConfig.freeChannelsLimit; FAQ price question now fetches real Stripe price instead of hardcoded "$9/month"


REFACTOR: Extract all hardcoded strings into locale system — created 4 locale files (landing, dashboard, auth) with 15+ components using centralized translations

## Previous

FIX: Worker Whisper fallback — fix critical bug where YouTube IP-block caused early return before Whisper was tried; fallback now always triggers correctly
FIX: Worker Whisper bitrate — lower MP3 quality from 192kbps to 64kbps so 19-min videos are ~8 MB instead of 25 MB (Groq API limit is 25 MB)
FIX: Worker Whisper size guard — add explicit 24.5 MB pre-check before Groq API call to avoid silent 413 errors
FIX: Worker config — use load_dotenv(override=True) so .env file always takes precedence over stale exported shell variables
FEATURE: Add test_pipeline_scenarios.py — comprehensive pipeline test with multiple video scenarios, --id, --whisper, --include-whisper flags

FEATURE: 7-day Pro trial on signup — trial starts at first login, unlimited active channels during trial, auto-downgrade to free after 7 days; "Trial" badge in nav; trial banner with countdown
FEATURE: SourcesSection search — compact default view (active channels only), search bar filters all saved channels with name highlighting, "X paused" button to expand full list
FEATURE: New monetization model — free users can import unlimited channels but only 3 can be active (receive summaries); toggle active/inactive per channel; upgrade prompt when trying to activate beyond limit
FIX: YouTube import during onboarding — callback now redirects to /onboarding instead of /dashboard/channels (which caused an infinite redirect loop); wizard detects youtube_imported param, fetches sources, and advances to step 2 automatically

FIX: Landing Demo — suppress hydration warning caused by Dashlane extension injecting data-dashlane-* attributes on form/input/button
FIX: Onboarding wizard — suppress hydration warning caused by Dashlane extension injecting data-dashlane-* attributes on form/input/button
FIX: CI — Remove missing global-teardown reference from playwright.config.ts (e2e/ dir doesn't exist yet)



FIX: Worker — hallucination Gemini : suppression de l'URL YouTube du prompt (Gemini utilisait sa connaissance d'entraînement au lieu de la transcription)
FIX: Worker — hallucination Gemini : length guidance corrigée pour les courtes transcriptions (plus jamais plus de mots demandés que l'original)
FIX: Subscription — ne retraite plus une vidéo déjà completed/pending/processing lors d'un nouvel abonnement (delivery créée directement)
REFACTOR: Worker — processor_loop concurrent : jusqu'à MAX_CONCURRENT_VIDEOS (défaut 3) vidéos traitées en parallèle via asyncio.Semaphore
FIX: Worker — _pick_lock (asyncio.Lock) sur pick_next_job pour éviter que deux tâches concurrentes sélectionnent le même job
REFACTOR: Worker — extraction de _process_video() comme coroutine indépendante, processor_loop simplifié

FEATURE: Create onboarding wizard /onboarding — 3 steps inline (add source, select voice, connect Telegram with live polling)
FEATURE: Unified dashboard — Sources, Summaries and Delivery sections on one page (remove separate channels/settings pages)
FEATURE: SourcesSection component with inline add/remove and dialogManager confirmation
FEATURE: DeliverySection component with Telegram inline modal (live polling) and compact voice selector
REFACTOR: Dashboard nav simplified — remove Channels and Settings links, keep Dashboard + Billing
CHORE: DB migration — add onboarding_completed to profiles, source_type to subscriptions
CHORE: Update Supabase TypeScript types with new columns

## 2026-02-18

FEATURE: P1 — Aha moment : queue la dernière vidéo immédiatement à l'abonnement d'une chaîne pour livraison instantanée sur Telegram
FEATURE: P2 — Try without signup : démo sur la landing qui résume n'importe quelle vidéo YouTube via Gemini sans créer de compte (rate-limited, 3 essais/10min)
FEATURE: P4 — Nouveau hero landing orienté bénéfice ("sans regarder une seule vidéo"), CTA "Recevoir mes résumés gratuitement", social proof, lien vers démo
FEATURE: P5 — Reverse trial 14 jours Pro pour les nouveaux inscrits : migration Supabase trial_ends_at, banner countdown dashboard, statut "Pro trial · X days left"
CHORE: Ajouter GEMINI_API_KEY à env.ts + @google/generative-ai
CHORE: Régénérer les types Supabase (trial_ends_at dans profiles)
FEATURE: Worker — log_bot.py, bot Telegram dédié au monitoring des logs worker (/logs, /errors, /status, /watch, /stop)
FIX: Worker — modèles Gemini restaurés avec gemini-3-flash-preview (confirmé fonctionnel dans les logs) + fallbacks gemini-3-pro-preview / gemini-2.5-flash / gemini-2.0-flash
FIX: Worker — transcript_extractor retournait 3 valeurs au lieu de 4 → ValueError au unpack dans main.py
FIX: Worker — db.requeue_job n'existait pas → remplacé par db.fail_job (qui requeue déjà automatiquement)
FIX: Worker — modèles Gemini 3 inexistants retirés de la liste → les 2 premiers échouaient toujours silencieusement
FIX: Race condition à l'abonnement — marquer toutes les vidéos comme "skipped" avant d'insérer la subscription, pour éviter que le scanner crée des deliveries pour les vieilles vidéos
FIX: Remove DATABASE_URL from env schema — Prisma removed, Supabase client used directly
FIX: Use HTTP 303 redirect in Stripe checkout route to force GET and avoid CloudFront 403
FIX: Use HTTP 303 redirect in Stripe portal route to avoid CloudFront 403
REFACTOR: Billing page — "Upgrade to Pro" now posts directly to Stripe checkout, removes /pricing intermediate step
REFACTOR: Complete code quality audit — 34 + 7 issues fixed (full audit pass)
FIX: Replace <img> with Next.js <Image> in channels page and summaries feed + add YouTube/Google image domains to next.config.ts
REFACTOR: Extract SummaryRow into dedicated summary-row.tsx (375-line component split)
FIX: Remove as unknown as type assertion in supabase/client.ts — throw explicit error on missing env vars
FIX: Type-safe res.json() and void async onClick in channels/page.tsx
FIX: Centralize APP_URL in worker/config.py — replace hardcoded https://brief-tube.com across bot_handler.py
CHORE: Run Prettier formatter across entire codebase
CHORE: Delete dead code (channels-list.tsx, add-channel-form.tsx, add-channel-button.tsx — unused components)
FIX: Convert interface to type in 3 files (summaries-feed, onboarding-stepper, pricing)
FIX: Fix async forEach race condition in useEffect — use Promise.allSettled
FIX: Sanitize videoId before URL interpolation to prevent XSS
FIX: N+1 queries in get_pending_deliveries — batch fetch videos and profiles (3 queries instead of 2N)
FIX: Stripe webhook — remove internal error details from response, add explicit signature check
FIX: bare except: → except Exception: in whisper_transcriber.py and gemini_browser.py (18 occurrences)
FIX: f.unlink() wrapped in try/except in tts_processor.py
FIX: chat_id validated before int() conversion in telegram_deliverer.py
FIX: Add Error Boundary (error.tsx) for dashboard
FIX: Wrap SummariesFeed in Suspense boundary
FIX: ESLint no-html-link-for-pages false positive on worker/ directory
FIX: Reset Supabase client on "Server disconnected" errors in delivery and RSS loops to force reconnection instead of reusing stale connection
FIX: Summaries feed now shows video processing status (completed/failed) instead of delivery status — videos marked "completed" no longer show "pending" badge
FIX: Onboarding step 3 now completes as soon as any delivery is created (not only after Telegram send)
FIX: Mark existing RSS videos as skipped when subscribing to a channel to prevent processing old videos
FIX: Fix "View summaries" button redirecting to home — now scrolls to summaries section via anchor
FIX: Restart worker to resolve Supabase connection issues and enable Telegram delivery
FIX: Add suppressHydrationWarning to forms to prevent Dashlane extension warnings
REFACTOR: Replace YouTube Data API with simple HTML scraping (free, no API key needed)
FEATURE: Add YouTube page scraping to fetch channel info (name, avatar) without API costs
FEATURE: Update favicon and logo to fast-forward icon (>>) representing content acceleration
FEATURE: Create youtube.ts helper to fetch real channel data from YouTube
FIX: Add YOUTUBE_API_KEY to environment schema for optional YouTube API integration
FIX: Update subscriptions API to accept both URL format and channelId/channelName format
FIX: Add URL parsing logic to extract channel info from YouTube URLs server-side
FEATURE: Create YouTube subscriptions API routes (/api/subscriptions) for channel management
FIX: Add missing API endpoints for adding/removing YouTube channels
FEATURE: Create Privacy Policy and Terms of Service pages for Google OAuth consent screen
FEATURE: Configure Google OAuth on Supabase for one-click authentication
FEATURE: Add Supabase trigger for new user signup handling
REFACTOR: Complete architecture simplification - Remove Better-Auth, keep only Supabase Auth
FEATURE: Add Google OAuth login with Supabase Auth (one-click authentication)
FEATURE: Create simplified login page with Google sign-in button (/login)
FEATURE: Add OAuth callback handler for Google authentication (/auth/callback)
FEATURE: Create simplified billing pages with Supabase (/dashboard/billing, /pricing)
FEATURE: Add Stripe checkout and portal API routes for Supabase Auth
REFACTOR: Simplify Stripe webhooks to use Supabase profiles table
REFACTOR: Remove all Better-Auth code (organizations, members, permissions)
REFACTOR: Remove Prisma ORM and use Supabase exclusively
REFACTOR: Add redirects from old /orgs/_ and /auth/_ routes to new /dashboard and /login routes
CHORE: Remove 100+ Better-Auth dependencies and simplify package.json
CHORE: Remove 15,000+ lines of unnecessary organization/auth code
CHORE: Clean up obsolete rules (authentication.md, prisma.md, api-routes.md, mandatory-dependencies.md)
DOCS: Create SIMPLIFICATION-PLAN.md with complete migration guide
DOCS: Update CLAUDE.md with new simplified Supabase-only architecture
DOCS: Create supabase-auth.md rule for authentication patterns
FIX: Remove all TypeScript errors and ensure build passes successfully

## 2026-02-18 (Earlier)

REFACTOR: Complete migration from organization-based to user-based billing system (Phases 1-6)
FEATURE: Add User.stripeCustomerId field and migrate Subscription relation to User model
FEATURE: Create data migration script to migrate billing data from organizations to users (prisma/migrate-billing-to-users.ts)
FEATURE: Add user-based billing actions (upgradeUserAction, openUserPortalAction, cancelUserSubscriptionAction)
REFACTOR: Update Stripe webhooks to support both organization and user-based billing during migration
REFACTOR: Remove organization plugin from Better Auth and add Stripe customer creation on user signup
CHORE: Update plans.action.ts to use authAction instead of orgAction for user-based billing
FEATURE: Create simplified /dashboard/billing pages (overview, plan selection) with user-based data
FEATURE: Add getUserWithSubscription query helper for fetching user subscription data
FEATURE: Create user-based billing components (UserPlanCard, UserBillingInfoCard, PortalButton)
REFACTOR: Update pricing-card.tsx to use useSession and upgradeUserAction for user-based subscriptions
REFACTOR: Update all billing URLs from /orgs/[slug]/settings/billing to /dashboard/billing

FEATURE: Add Telegram monitoring system for worker with real-time alerts and admin commands (/monitor_status, /monitor_stats, /monitor_logs)
FEATURE: Add worker management scripts (start.sh, stop.sh, restart.sh)
FEATURE: Add console email adapter for development (shows verification links in logs instead of sending emails)
FIX: Email verification bug - links now shown in console during development when Resend is not configured
FIX: Disable mandatory email verification on signup (users can now login immediately without verifying email)
FIX: Add proper error handling and logging in billing actions to prevent JSON parse errors
FIX: Update Stripe price ID configuration to use STRIPE_PRO_PRICE_ID instead of STRIPE_PRO_PLAN_ID
FIX: Redirect legacy dashboard billing page to organization billing to fix 405 and JSON parse errors
CHORE: Add psutil dependency for system monitoring
FEATURE: Add dynamic favicon generation using Next.js ImageResponse API matching site logo
REFACTOR: Rename project from "Boilerplate" to "BriefTube" across all configuration files
CHORE: Remove obsolete integration documentation (README-INTEGRATION.md, INTEGRATION-ANALYSIS.md, INTEGRATION-SUMMARY.md, integrate-brieftube.sh)
REFACTOR: Update init-project skill documentation to use "template" instead of "boilerplate"
FIX: Fix worker SSL certificate error by restarting from correct project location
FIX: Make Stripe and email environment variables optional to allow builds without payment/email configuration
FIX: Update stripe.ts to handle optional STRIPE_SECRET_KEY with proper type casting
FIX: Configure pre-commit hook with TypeScript and ESLint checks to prevent build failures
FIX: Update ESLint configuration to ignore worker/ directory and Python virtual environment files
FIX: Update GitHub Actions workflows to make Stripe/Resend secrets optional and rename database to brieftube_test
FIX: Make Resend client initialization conditional to handle missing API keys during builds
FIX: Make Supabase client return null during CI builds when environment variables are missing
FIX: Fix generateStaticParams in posts page to return demo fallback for empty posts array
FIX: Fix generateStaticParams in docs and changelog pages with proper error handling
CHORE: Add svix package for Resend webhook signature verification
CHORE: Add content directory (posts, docs, changelog) to repository for proper builds
FEATURE: Enable manual workflow dispatch trigger for GitHub Actions

## 2026-02-17

CHORE: Complete cleanup for public repo - removed template docs, AI configs, and 33 unnecessary files
SECURITY: Remove sensitive files from Git tracking - 21,265 files removed (browser cookies, session data, IDE configs, logs)
CHORE: Update .gitignore to prevent committing worker/cookies/, .cursor/, worker/\*.log, and local settings
FEATURE: Add pre-commit hook with Husky to run TypeScript check and lint on staged files before each commit
FIX: Fix all ESLint and TypeScript errors in dashboard components and API routes
REFACTOR: Convert function declarations to useCallback for proper React hooks behavior
CHORE: Replace console.error with logger.error across all API routes and components
FEATURE: Add BriefTube favicon and logo assets
CHORE: Update .gitignore to exclude worker temporary files, logs, and Python cache
CHORE: Add ngrok tunnel startup script for development
FIX: Make postinstall script optional to prevent Vercel build failures when DATABASE_URL is not available
FIX: Use placeholder DATABASE_URL in Prisma config to prevent build failures during CI/Vercel builds
FIX: Skip environment variable validation during Vercel builds using SKIP_ENV_VALIDATION flag
CHORE: Make email and Stripe publishable key optional as they are not currently in use
FIX: Remove prisma migrate deploy from vercel-build to prevent deployment failures

## 2026-02-15

REFACTOR: Rename project from "NOW.TS" to "BriefTube" template base across all configuration files (package.json, site-config.ts, README.md, CLAUDE.md)

## 2026-01-19

FEATURE: Add x-org-slug header support for /api/orgs/\* routes in middleware

## 2026-01-18

CHORE: Add Prisma security and performance rules (orgId filtering, select over include, codebase patterns)
FEATURE: Add domain question to init-project workflow for Resend email configuration (with/without domain support)

## 2026-01-13

CHORE: Remove 14 unused files including admin components, docs components, and utility files
CHORE: Remove 5 unused dependencies (@ai-sdk/openai, ai, @types/react-syntax-highlighter, radix-ui, ts-node) saving ~3MB
REFACTOR: Remove duplicated FileMetadata type from avatar-upload.tsx, import from use-file-upload.ts instead
REFACTOR: Replace session-based organization context with URL slug-based routing using middleware headers for multi-tab support
FIX: Update hasPermission to pass explicit organizationId for Better Auth compatibility
REFACTOR: Move legal and docs links from floating footer to minimal sidebar navigation above Settings button with text-xs

## 2026-01-02

REFACTOR: Add cacheLife("max") to docs, changelog, and posts pages for 30-day cache instead of 15-minute default
REFACTOR: Improve mobile nav user button to show avatar + name/email with dropdown instead of just avatar
FEATURE: Add responsive mobile navigation for documentation with sticky header and sheet sidebar
FIX: Fix documentation page horizontal overflow when description text is too long
FEATURE: Add /add-documentation slash command for creating and updating docs in content/docs/
REFACTOR: Add useDebugPanelAction and useDebugPanelInfo hooks for cleaner debug panel registration with automatic cleanup
FIX: Improve changelog dialog responsiveness on mobile with smaller padding and text sizes

## 2025-12-28

REFACTOR: Replace admin back button with breadcrumb navigation (matching org page style)

## 2025-12-27

REFACTOR: Merge billing info into single card with next payment date, amount, and payment method
FEATURE: Add "Create customer" button to auto-create Stripe customer for organizations
FEATURE: Add inline title editing with org avatar on admin organization detail page
FEATURE: Add coupon code support for admin subscription management (enables 100% off plans without payment method)
REFACTOR: Admin user organizations list uses badges for role and plan instead of text with dots
REFACTOR: Admin user organizations list uses proper ItemGroup pattern with separators and unified border
REFACTOR: Modernize admin subscription UI with plan cards, monthly/yearly toggle, and status indicators
REFACTOR: Feedback detail page uses Item component instead of Card for consistent styling
REFACTOR: Post detail page now matches changelog detail style - max-w-2xl layout, aspect-video image, badges with icons, prose content
REFACTOR: Simplify admin charts with Stripe-style design - hero numbers, no grid, cleaner layout
REFACTOR: Use dot style badges for status indicators in admin user sessions and providers tables
FEATURE: Add MRR growth and user growth charts to admin dashboard with Stripe data
REFACTOR: Remove 15 PostCard variants, keep single clean compact design
REFACTOR: Consolidate image upload components into unified ImageDropzone with avatar/square variants
REFACTOR: Unify sidebar trigger button style across all navigation components
REFACTOR: Add size="lg" to all admin dashboard pages for consistent layout width
CHORE: Add v2.1.0 changelog entry and update image paths
REFACTOR: Changelog timeline with vertical line on left, date labels, and compact cards
FEATURE: Add active state highlighting to content header navigation
FIX: Remove pulsing animation from changelog timeline first item
REFACTOR: Modernize changelog UI with docs-style header, footer, and blog post layout
REFACTOR: Changelog detail page now uses aspect-video image, cleaner badges, and prose styling
REFACTOR: Changelog list page uses card-based layout with hover effects and latest badge

## 2025-12-26

FEATURE: Changelog page timeline view with vertical timeline, version badges, and hover effects
CHORE: Add unit tests for changelog-manager and changelog actions
CHORE: Add E2E tests for changelog dialog flow
FIX: InterceptDialog uses router.refresh() after router.back() to reset parallel route slot state
FIX: InterceptDialog only calls router.back() when closing, not on every state change
FEATURE: Add "Reset Changelog" debug action to restore dismissed changelogs
FEATURE: Debug Panel with draggable/resizable UI, session info, and dynamic action buttons (dev only)
FEATURE: Public changelog system with CardStack animation and timeline UI
FEATURE: Changelog CardStack widget in organization sidebar
FEATURE: Intercepting routes for changelog dialog from any page
FEATURE: Claude Code slash command for creating changelog entries
FEATURE: Add reply button with textarea dialog on feedback detail page
FEATURE: Clickable user Item on feedback detail page navigates to user profile
REFACTOR: Replace feedback table with Item components for cleaner UI

## 2025-12-15

FIX: Remove insecure trusted origins wildcard configuration in auth
FIX: Use hard redirects for impersonation to update profile button immediately
FIX: Breadcrumb path selection slice issue
FIX: Typo in prisma:generate script
FIX: ESLint and TypeScript errors across codebase
FIX: Vitest config ESM conversion
FIX: generateStaticParams for posts in production (Next.js 16 compatibility)

FEATURE: Major performance improvements with refactored application architecture
FEATURE: TanStack Form migration replacing React Hook Form across all forms
FEATURE: Redis caching for improved performance
FEATURE: OTP-based password reset flow
FEATURE: Complete OTP sign-in flow implementation
FEATURE: Responsive provider buttons (full width when single provider)
FEATURE: Global PageProps type for standardized page component typing

REFACTOR: Middleware utilities extraction with admin route protection

CHORE: Update Better-Auth to version 1.3.27
CHORE: Update VSCode snippets and workflow configuration
CHORE: Add environment variables guide
CHORE: Improve type safety in chart and tooltip components
CHORE: Remove unused shadcn-prose dependency

## 2025-08-23

FEATURE: GridBackground component for customizable visual design
FEATURE: Admin feedback system with filters, tables, and detailed views
FEATURE: Documentation system with dynamic content and sidebar navigation
FEATURE: Last used provider tracking for enhanced sign-in experience
FEATURE: Contact and about pages

CHORE: Update Next.js to 15.5.0
CHORE: Update React to 19.1.1
CHORE: Update AI SDK to v5
CHORE: Update all Radix UI component packages
CHORE: Update testing dependencies and build tools
CHORE: Claude Code integration with new agents, commands, and formatting hooks
CHORE: Improve API file organization and documentation structure

## 2025-08-13

FEATURE: Complete admin dashboard with sidebar layout and routing
FEATURE: Admin-only authentication guards with role checking
FEATURE: User management interface with search, pagination, and role filtering
FEATURE: User detail pages with session management and impersonation
FEATURE: Organization management interface with member management
FEATURE: Subscription management with plan changes and billing controls
FEATURE: Payment history with Stripe integration for admin oversight
FEATURE: AutomaticPagination reusable component

REFACTOR: Move billing ownership from User to Organization level
REFACTOR: Migrate stripeCustomerId from User model to Organization model
REFACTOR: Update webhook handlers for organization-based billing
REFACTOR: Replace Better-Auth subscription methods with custom server actions
REFACTOR: Billing page with Card components and Typography

FIX: Remove all `any` type usage in Stripe webhook handlers
FIX: Type compatibility issues across billing system
FIX: Card hover effects replaced with clean styling
FIX: Organization/user names now clickable instead of separate View buttons

## 2025-07-14

FEATURE: Playwright workflow migrated to local CI testing with PostgreSQL service
FEATURE: Comprehensive logging throughout all E2E tests

REFACTOR: Migrate Prisma configuration from package.json to prisma.config.ts
REFACTOR: Rename RESEND_EMAIL_FROM to EMAIL_FROM

FIX: Delete account test case sensitivity issue
FIX: Button state validation and error handling in tests
FIX: External API dependency error catching for build
FIX: DATABASE_URL_UNPOOLED configuration for Prisma
FIX: OAuth secrets renamed (GITHUB to OAUTH_GITHUB)

CHORE: Add all required GitHub secrets for CI testing
CHORE: Enhance Playwright reporter configuration for CI visibility

## 2025-06-01

FEATURE: Orgs-list page to view organization list
FEATURE: Adapter system for email and image upload

FIX: API Error "No active organization"

CHORE: Upgrade libraries to latest versions

## 2025-05-03

FEATURE: NOW.TS deployed app tracker
FEATURE: Functional database seed

## 2025-04-17

FEATURE: Resend contact support

REFACTOR: Prisma with output directory
REFACTOR: Replace redirect method
REFACTOR: Update getOrg logic to avoid bugs

FIX: Navigation styles
FIX: Hydration error

CHORE: Upgrade to Next.js 15.3.0

## 2025-04-06

FEATURE: Better-Auth organization plugin
FEATURE: Better-Auth Stripe plugin
FEATURE: Better-Auth permissions
FEATURE: Middleware authentication handling

REFACTOR: Replace AuthJS with Better-Auth
REFACTOR: Upgrade to Tailwind V4
REFACTOR: Layout and pages upgrade

## 2024-09-12

FEATURE: NEXT_PUBLIC_EMAIL_CONTACT env variable
FEATURE: RESEND_EMAIL_FROM env variable

## 2024-09-08

FEATURE: Add slug to organizations
REFACTOR: Update URL with slug instead of id

## 2024-09-01

FEATURE: NOW.TS version 2 with organizations
