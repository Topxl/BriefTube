# Changelog

## 2026-03-14

FEATURE: Video processing preview card — shows thumbnail, title, and animated progress bar after submitting a video URL

## 2026-03-13

FIX: Sécurité — routes admin API utilisent env.ADMIN_USER_ID au lieu d'un UUID hardcodé
FIX: Sécurité — webhook Resend rejette les requêtes non-signées si RESEND_WEBHOOK_SECRET manquant
FIX: Sécurité — Notion OAuth token stocké en cookie httpOnly au lieu d'être exposé dans l'URL
FIX: Sécurité — select-database Notion lit le token depuis le cookie au lieu du body
FIX: Sécurité — email tracking valide le format UUID avant de requêter la DB
FIX: Sécurité — worker /health, /logs et /services acceptent Authorization Bearer header au lieu de ?token= dans l'URL
FIX: Sécurité — routes admin Next.js transmettent le token worker via header Authorization

## 2026-03-12

FIX: Worker — retire "requested format is not available" et "no video formats found" de la détection live en connexion directe (false positive YouTube IP block → continue vers client suivant)
FEATURE: WhatsApp magic link — remplace OTP (utilisateur clique lien wa.me pré-rempli, envoie token bt-XXXXXX)
REFACTOR: WhatsApp — token-based magic link au lieu de phone+code OTP (registration, webhook, database)
REFACTOR: Worker — endpoint /send-whatsapp-otp remplacé par GET /get-whatsapp-link
REFACTOR: Dashboard delivery-section — WhatsApp UI remplacée (deux étapes → magic link + polling)
CHORE: DB migration — colonne token sur whatsapp_verifications, phone et code deviennent nullable
CHORE: Types Supabase regénérés (whatsapp_verifications avec token)
FEATURE: Multi-platform delivery architecture — Notion et WhatsApp en plus de Telegram
FEATURE: Table platform_connections en DB — connexions Telegram migrées, nouvelle table whatsapp_verifications
FEATURE: Worker — dispatcher _dispatch_delivery multi-plateforme (telegram/notion/whatsapp)
FEATURE: Worker — notion_deliverer.py (création de pages Notion) + whatsapp_deliverer.py (Meta Cloud API)
FEATURE: Next.js — OAuth Notion (routes connect/callback/select-database/disconnect)
FEATURE: Next.js — WhatsApp connexion par OTP (register/verify/disconnect + webhook Meta)
REFACTOR: Worker db.py — multi-platform delivery support via platform_connections table (get_platform_connections_for_users, mark_user_platform_disconnected, updated create_deliveries_for_video, get_pending_deliveries, cleanup_undeliverable_deliveries, mark_user_telegram_disconnected, get_profile_by_telegram)
REFACTOR: Worker bot — migrate Telegram linking from profiles.telegram_chat_id to platform_connections table
REFACTOR: Dashboard delivery-section — sections Notion et WhatsApp ajoutées, polling platform_connections
CHORE: Types Supabase regénérés (platform_connections, whatsapp_verifications, deliveries.platform)
FIX: Worker — retire "requested format is not available" de la détection live stream via proxy (faux positif bloquant toute la queue depuis ce matin)

## 2026-03-09

PERF: Landing — ISR revalidate=3600 sur la home page pour servir depuis le CDN (TTFB 1.6s → ~50ms)
PERF: Landing — preload de l'image LCP (thumbnail YouTube hero card 0) + priority prop sur Next/Image
PERF: Layout — Rewardful queue script beforeInteractive → afterInteractive (supprime le script render-blocking)
PERF: Layout — ajout dns-prefetch pour r.wdfl.co (Rewardful CDN)
FIX: Accessibilité — progressbar Hero : ajout aria-label, aria-valuemin, aria-valuemax (score 93 → ~95)

CHORE: Analytics — ajout Google Analytics GA4 (G-NSS12KB41V) au tag gtag existant
FEATURE: Bot Telegram — bouton "📋 Copy link" dans le menu Share (CopyTextButton natif, copie sans nouveau message)
FEATURE: Affiliation — intégration Rewardful (scripts layout, referral hidden input sur tous les formulaires checkout, client_reference_id passé à Stripe)

FEATURE: Bot Telegram — toutes les actions Options en inline (Share, Subscribe, Unsubscribe) sans nouveau message
FEATURE: Bot Telegram — confirmation ⏳/✓ avec show_alert lors du changement de langue (génération vs déjà prêt)
FEATURE: Bot Telegram — sélecteur de langue inline (edit_reply_markup) : favoris ⭐ en premier, ✓ déjà générée, bouton "Manage favorites" → profil web, bouton ← Back
FEATURE: Bot Telegram — sélecteur de langue synchronisé avec les favoris du dashboard (⭐ en premier, ✓ = déjà générée)
FIX: Bot Telegram — retire le bouton "Language" du clavier Share (déplacé dans Options)
FEATURE: Bot Telegram — ajoute bouton "🌐 Language" dans le menu Options
FEATURE: Dashboard — sélecteur de langue avec système de favoris (étoiles) + sous-menu "Other languages" pour les non-favoris
FEATURE: DB — colonne `favorite_languages text[]` sur la table profiles
FIX: DB — contrainte `processed_videos_transcript_source_check` élargie pour accepter les nouvelles sources (youtube_api, invidious, piped, yt-dlp, whisper)
CHORE: Worker — health check proxy Webshare ajouté au endpoint `/services`
CHORE: CLAUDE.md — réécriture complète (suppr. marketing/bloat, schéma DB à jour, infos VPS/Worker)

## 2026-03-07

REFACTOR: Comparison pages — rewrite all prose to sound more natural and human (vary sentence structure, add intellectual hesitation, avoid generic AI vocabulary)
FEATURE: SEO — 4 nouvelles pages VS après recherche concurrentielle approfondie (TubeOnAI, Snipcast, Summarize.tech, Kome.ai)
REFACTOR: SEO — réécriture de tous les textes des 14 pages VS pour un ton plus naturel et moins générique
FIX: SEO — corriger "3 channels free" → "5 channels free" + prix Eightify dans les comparaisons existantes

PERF: Layout — preconnect pour img.youtube.com + googletagmanager.com + dns-prefetch noembed.com (élimine 300-500ms de DNS lookup mobile)
PERF: Dashboard — Suspense autour de PersonalStats (3 requêtes DB dont une séquentielle) : page streame sans attendre les stats
PERF: Login — suppression "use client" (page redevient Server Component) + orbes blur 150px → 60px + animations orb-drift supprimées
PERF: DashboardNav — useRecentDeliveriesCount() migré vers TanStack Query (staleTime 5min) : une seule requête puis cache, zéro refetch par navigation
PERF: DashboardNav — transition-all → transition-colors duration-150 sur les liens desktop et mobile
PERF: Hook usePrices — remplace le double useEffect/fetch vers /api/stripe/price dans Pricing et FAQ par TanStack Query (une seule requête, cachée 1h)
PERF: Demo — <img> natif → <Image> Next.js avec loading="lazy" (WebP/AVIF automatique)
PERF: Hero — suppression animation float (6s infinite GPU) sur le mockup Telegram ; blur des orbes réduit de 150px → 60-80px
PERF: Navbar — transition-all (toutes propriétés) → transition-colors duration-150 sur les liens ; suppression de l'animation ::after width (reflow)
PERF: CSS — glass-strong backdrop-filter réduit de blur(40px) → blur(20px)
PERF: Google Ads — strategy="afterInteractive" → "lazyOnload" (se charge à l'idle navigateur)
PERF: Inter font — weight limité à [400,500,600,700] au lieu de tous les weights disponibles
PERF: next.config.ts — formats AVIF/WebP activés explicitement + minimumCacheTTL 7 jours sur les images
PERF: Fonts — display: "swap" → "optional" sur les 3 fonts (Inter, Space_Grotesk, Geist_Mono) pour supprimer le blocage rendu
PERF: Hero — suppression des animations CSS orb-drift (GPU) sur les 3 orbes ; preload="metadata" → "none" sur les 2 audio
PERF: Landing page — Suspense fallback={null} sur les 8 composants dynamic() pour débloquer l'hydratation
PERF: CSS — suppression de background-attachment: fixed (forçait un repaint total au scroll)
PERF: Channels — remplacement des <img> natifs par <Image> Next.js avec priority (avatar) et loading="lazy" (thumbnails)
PERF: Providers — PostHogIdentify wrappé dans Suspense pour déférer son hydratation

## 2026-03-06

FIX: DB — mise à jour de la contrainte transcript_source pour inclure youtube_api, invidious, piped, yt-dlp, whisper (était limité à youtube/groq/manual)
FEATURE: Admin — ajout du proxy YouTube (Webshare) dans le health check des services (détecte quota épuisé 402)
FIX: Lists — avatars manquants résolus via after() qui scrape YouTube et sauvegarde en base ; fallback immédiat ui-avatars.com (à la place du div rouge custom)
FIX: Lists — avatars des chaînes résolus depuis la table subscriptions quand channel_avatar_url est null dans list_channels
PERF: Import YouTube — pré-marquage RSS déplacé en tâche de fond via after() : redirect immédiate au lieu d'attendre 15-30s pour 100+ chaînes
FEATURE: Onboarding — remplace le wizard pleine page par un module "Get started" inline dans le dashboard (disparaît automatiquement quand channel + Telegram sont configurés)
REFACTOR: /onboarding redirige désormais vers /dashboard ; onboarding-wizard.tsx supprimé
FIX: Worker — transcript_source, transcript_length, summary_length, source_language, processing_time_s correctement sauvegardés en base (étaient dans le JSON metadata au lieu des vraies colonnes)
REFACTOR: Dashboard — Sources section simplifiée : pills All/Active/Paused toujours visibles dans le header, import YouTube réduit à une icône, boutons bulk supprimés, Trash visible au hover uniquement
REFACTOR: Dashboard — bouton bulk unique intelligent : "Activate all" si des chaînes sont en pause, "Pause all" si toutes sont actives (remplace "All on" / "All off")
REFACTOR: Dashboard — statut actif/pausé des chaînes plus visible : point vert/gris sur l'avatar, texte "Paused", bouton Play en vert pour les chaînes en pause

## 2026-03-05

FEATURE: Admin — section "Services" avec health check en temps réel (Gemini, Groq/Whisper, Telegram, Invidious) + sources de transcripts 24h
FIX: Worker — "Requested format is not available" ne déclenche plus un snooze live infini dans _ytdlp_subtitles proxy — la vidéo passe maintenant à Whisper ou échoue proprement
FEATURE: Dashboard — composant Banner unifié (warning/danger/info/success) pour trial-banner, push-notification-banner et limite sources
FEATURE: Dashboard — empty states pour summaries-feed (icône Inbox + message) et personal-stats (message discret)
REFACTOR: Dashboard — titres sections en text-base (Sources, Your stats, Recent summaries) pour hiérarchie visuelle
REFACTOR: Dashboard — boutons Play/Pause/Delete dans sources-section toujours visibles (opacity /60 vs /25)
REFACTOR: Dashboard — typographie standardisée : text-[11px]→text-xs (dates, labels), text-[9px]→text-[10px] (badges)
FIX: Worker — marquer telegram_connected=false quand Telegram rejette définitivement (bot bloqué), et filtrer ces utilisateurs dès la création des livraisons
FIX: Admin — "Livraisons échouées" renommé en "Non délivrés" avec variant warning (bot bloqué / injoignable n'est pas une vraie erreur technique)
FEATURE: Admin — section "Vidéos échouées" remplace "Derniers échecs" : liste toutes les vidéos failed avec lien YouTube cliquable, channel_id, nombre de tentatives (failure_count)
REFACTOR: Worker transcript_extractor — Invidious/Piped EN PREMIER dans la chaîne de fallback (avant yt-dlp) : évite 4s de latence inutile sur IPs VPS bloquées par YouTube

## 2026-03-04

FEATURE: Admin — bouton "Copier" les logs dans le panel worker (copie dans le presse-papier avec retour visuel)
FEATURE: Admin — bouton "Copier" les erreurs récentes dans le panel worker

## 2026-03-03

FEATURE: UX — effet wow post-import YouTube : afficher les résumés audio déjà traités avant de passer au step 2 de l'onboarding
FEATURE: UX — waveform animée dans le player audio des summary-row (barres CSS keyframe)
FEATURE: UX — skeleton loaders pulse sur les cards de résumés en cours de chargement
FEATURE: UX — badge pulse rouge sur l'onglet Dashboard indiquant les nouveaux résumés des 24h

FEATURE: Admin — section email analytics avec stat cards (total / 30j / campagnes), bar chart 14j et tableau breakdown par type de campagne (counts total + 30j + date dernier envoi)

FEATURE: SEO — ajouter og:image + twitter:images dans blog article metadata pour le partage social
FEATURE: SEO — ajouter BreadcrumbList schema JSON-LD sur /blog/[slug], /vs, /vs/[competitor]
FEATURE: UX — remplacer header custom sticky par Navbar flottante partagée sur /vs et /vs/[competitor]
FEATURE: UX — ajouter Footer sur /vs et /vs/[competitor] pour cohérence visuelle
FEATURE: Content — ajouter 8 nouveaux pages de comparaison concurrents : Kagi Summarizer, Glasp, Merlin AI, TubeSummary, Mindgrasp, Tactiq, Podwise, Snipd
FEATURE: SEO — ajouter JSON-LD ItemList et BreadcrumbList sur page channel et video pour améliorer la structuration des données
FEATURE: Blog — ajouter 3 nouveaux articles : "summarize-youtube-videos-automatically", "youtube-as-podcast-audio-feed", "best-ai-tools-youtube-2026"
FEATURE: Créer page publique /videos/[video_id] pour le SEO — affiche les résumés IA des vidéos YouTube avec métadonnées OpenGraph + JSON-LD VideoObject
FEATURE: Mettre à jour sitemap.tsx — ajoute les 1000 dernières vidéos traitées à la génération du sitemap pour une meilleure indexation Google
PERF: Landing — cache "use cache: remote" + cacheLife("hours") sur SocialProof pour éviter les requêtes Supabase à chaque page load
PERF: Landing — remplace <img> par Next.js <Image> dans Hero pour l'optimisation WebP et lazy loading
PERF: Landing — dynamic() imports pour les sections below-fold (Problem, HowItWorks, Demo, Features, Pricing, FAQ, FinalCTA, Footer) pour réduire le JS initial
PERF: Layout — ajout de display:"swap" aux 3 Google Fonts (Inter, Space_Grotesk, Geist_Mono) pour améliorer FCP

FIX: Sitemap — channels/ : ne liste plus que les channels avec au moins un résumé terminé (filtre sur lastSummaryByChannel), évite 400+ entrées 404 dans Google Search Console
FEATURE: Blog — refonte style pour correspondre à l'identité visuelle du site : navbar flottante + footer partagés, cards nm-raised avec hover lift, badge catégorie rouge, article header nm-raised, CTA avec glow rouge, bouton retour avec ArrowLeft icon
FEATURE: Dashboard — bannière push notifications non-intrusive : apparaît uniquement si permission === "default" et non dismissée (localStorage), bouton Enable + dismiss X, disparaît automatiquement après activation
FIX: Onboarding — supprime le prompt de notifications push (causait le warning spam Chrome), remplacé par le banner dashboard ci-dessus

UX: Onboarding wizard — sélection de méthode de livraison plus visible : fond coloré + scale + checkmark en coin + texte/badge actifs selon la couleur de chaque plateforme

PERF: noembed API — ajout AbortController 3s timeout + catch silencieux pour éviter que l'UI se bloque sur les titres manquants
PERF: Onboarding Telegram polling — limite à 40 tentatives max (2 min) pour éviter les requêtes Supabase infinies
PERF: lists/page — publicLists query intégrée dans Promise.all avec les 3 autres requêtes (4 requêtes parallèles au lieu de 3+1)

PERF: Navigation dashboard — supprime connection() (rendering dynamique forcé), ajoute staleTimes (dynamic:30s, static:180s) pour le router cache client, parallélise les requêtes Supabase avec Promise.all dans dashboard/page, profile/page et personal-stats

## 2026-03-02

FIX: Deploy — pnpm onlyBuiltDependencies pour autoriser sharp/esbuild à compiler leurs bindings natifs (pnpm@10 les bloquait → crash Vercel à la phase "Deploying outputs")

FEATURE: Onboarding wizard step 2 — replace mandatory Telegram with a delivery method picker (Telegram + Website available, Email/WhatsApp/Discord/Slack coming soon with PostHog vote tracking)
FIX: Worker — live terminés : "This live event has ended" et "Requested format is not available" désormais détectés comme video_is_live (snooze 2h) au lieu de youtube_auth_required (3 retries inutiles) — dans transcript_extractor et whisper_transcriber (loop + proxy)

## 2026-02-28

FIX: CI — playwright.yml : fallbacks pour les secrets Supabase/Stripe/Google non configurés dans GitHub Actions, évite l'erreur "Missing Supabase environment variables" au prerender
FIX: Demo landing — messages d'erreur traduits en anglais, modèle Gemini mis à jour gemini-1.5-flash → gemini-2.0-flash, résumé généré en anglais
FIX: /api/stripe/price — remplace export const dynamic par connection() (incompatible avec cacheComponents:true)
FIX: Onboarding page — supprime la prop curatedLists plus utilisée par OnboardingWizard
FIX: Worker — détection des live streams via proxy : "no video formats found" → video_is_live (pas youtube_auth_required)
FIX: Worker integration tests — remplacement des vidéos géo-bloquées (multilang) par des IDs accessibles, ajout test live alSyMiZvsO8

FEATURE: Admin — bouton "Send apology emails" pour notifier les utilisateurs bloqués (Feb 22–28) que le service est rétabli et demander du feedback
FIX: Onboarding — boucle de redirection infinie résolue : mise à jour onboarding_completed directement via le client Supabase navigateur (admin-client server action échouait silencieusement)
FIX: Dashboard — ajout de connection() pour forcer un rendu live et éviter qu'un cache stale serve onboarding_completed=false après le fix
FEATURE: Web Push Notifications — service worker, VAPID infra, /api/push/subscribe|unsubscribe|send routes, prompt discret dans l'onboarding step 2
FEATURE: Section Notifications dans /dashboard/profile — 3 toggles : push navigateur, newsletter, annonces (colonnes DB + composant NotificationsSection)
FEATURE: Worker Python déclenche une web push après chaque livraison Telegram réussie (_notify_push via aiohttp, best-effort)
REFACTOR: Onboarding wizard — remove language selection step (3 steps to 2 steps), language now auto-detected server-side
FIX: OG/stat portrait — chiffres "47 min → 4 min" empilés verticalement (↓) pour éviter le débordement horizontal à 160px
FIX: OG/telegram portrait — justifyContent:center pour éviter le grand vide au milieu (space-between trop agressif sur 1350px de haut)
FIX: OG/before-after square+portrait — layout vertical (colonne) avec chiffres à droite et flèche ↓ ; OG/stat square+portrait — structure 3 zones (header + center + brand badge) ; OG/telegram square — gap réduit, no flex-grow sur colonne texte
FIX: OG/before-after landscape — crash Satori silencieux (div sans display:flex + textTransform:undefined incompatibles avec next/og streaming render)

FIX: Onboarding step 2 — sélection de langue trop subtile ; ajout fond rouge teinté + ring rouge + icône check pour rendre l'état sélectionné clairement visible
FEATURE: Onboarding — détection automatique de la langue via Accept-Language header ; pré-sélectionne et sauvegarde la voix TTS correspondante si le profil a encore la voix par défaut
FIX: Google OAuth local dev — redirect_uri pointait vers la prod (NEXT_PUBLIC_SITE_URL) au lieu de localhost ; utilise maintenant new URL(request.url).origin pour dériver le bon baseUrl automatiquement
FIX: Onboarding "Skip for now" step 3 — navigation vers /dashboard bloquée en boucle ; remplace router.push (cache Next.js) par window.location.href + revalidatePath("/dashboard") dans completeOnboarding()
REFACTOR: ListPicker — supprime barre de recherche, filtre catégorie "Other", remplace fonds colorés+icônes par vraies images (thumbnails YouTube representatifs par catégorie + gradient overlay)
REFACTOR: Onboarding step 1 — "Import from YouTube" devient l'action principale (bouton rouge prominent), formulaire d'ajout manuel visible par défaut, playlists curées déplacées en option secondaire sous un séparateur "or discover channels by topic"
FIX: Dashboard personal-stats — "Most active channels" affichait l'ID YouTube au lieu du nom pour les chaînes désinscrites (fetch toutes les souscriptions pour le channelNameMap, pas seulement active=true)
FIX: Admin — Top chaînes préfère un vrai nom au channel ID si plusieurs rows contradictoires

FIX: Worker — live stream détecté via proxy : "No video formats found" dans le handler proxy de transcript_extractor._ytdlp_subtitles et whisper_transcriber._download_audio retourne maintenant video_is_live (snooze 2h) au lieu de youtube_auth_required (3 retries inutiles)
FIX: Worker whisper_transcriber — supprime extra_body service_tier (paramètre non supporté par l'API Groq Whisper → 400 error → 21+ échecs production) ; supprime aussi APIStatusError devenu inutilisé
CHORE: Tests intégration — remplace IDs vidéos multilang instables (France24, TED español géo-bloqués) par IDs plus stables + expected="any" car disponibilité multilingue dépend de l'IP réseau
FEATURE: Worker tests — suite de 123 tests unitaires pytest (test_youtube_utils, test_rss_scanner, test_transcript_extractor) + runner d'intégration run_integration.py avec 16 cas couvrant tous les edge cases (court, long, musique, live, multilingue, vidéos échouées en prod)

REFACTOR: Worker — centralise constantes/helpers YouTube dans youtube_utils.py (_PREMIERE_RE, hours_until_premiere, PLAYER_CLIENTS_FULL/SHORT, BOT_DETECTION_KEYWORDS, INVIDIOUS_INSTANCES, PIPED_INSTANCES, extract_video_id) → supprime duplication entre transcript_extractor, whisper_transcriber et rss_scanner
FEATURE: Worker — ajoute Piped comme second proxy gratuit fallback pour subtitles (transcript_extractor._piped_subtitles) et audio Whisper (whisper_transcriber._download_audio_via_piped) : chaîne yt-dlp → Invidious → Piped → proxy payant
PERF: Worker whisper_transcriber — réduit PLAYER_CLIENTS à 2 (ios → tv_embedded) pour les téléchargements audio Whisper : fail-fast vers les proxies gratuits, évite 2 clients redondants (android ≈ ios sur datacenter IP)
PERF: Worker delivery_loop — session aiohttp persistante pour les téléchargements audio (reusée entre livraisons, évite TCP+TLS handshake par livraison)

## 2026-02-27

FEATURE: Whisper — téléchargement audio via Invidious API (gratuit) avant fallback proxy payant : résout l'URL stream depuis instances publiques + ffmpeg, économise le proxy payant
FEATURE: Worker — fallback chain ios→android→tv_embedded→mweb dans _download_audio et _ytdlp_subtitles + Invidious API comme proxy YouTube gratuit (contourne bot-detection VPS) + proxy HTTP (YOUTUBE_PROXY_HTTP) en dernier recours pour yt-dlp et Whisper + force-update yt-dlp à chaque déploiement
FIX: Worker whisper_transcriber — détecter géo-restriction ("your country") tôt dans _download_audio pour abandonner immédiatement sans tester tous les clients → retourne "audio_geo_restricted" (fail permanent, pas de retry)
FIX: Worker — désactive aiohttp access_log (access_log=None) pour éviter boucle de rétroaction : chaque poll /logs écrivait dans worker.log et noyait les vraies infos
FIX: WebSub — réduit concurrence 50→2 + délai 500ms entre requêtes pour éviter HTTP 429 du hub PubSubHubbub, ne marque plus "failed" sur 429 pour éviter re-soumission immédiate
FIX: PostHog — identify() : supprime guard posthog.__loaded (silencieux), re-capture $pageview après identify pour lier la première page au profil utilisateur
CHORE: Supprime public/images/icon.png (ancienne icône) — remplace par /logo-120.png dans site-config.ts appIcon

FEATURE: Générateurs d'images Google Ads — /api/og/ads/telegram, /api/og/ads/before-after, /api/og/ads/stat (formats square/portrait/landscape)
FIX: OG/before-after — Satori crash corrigé (div sans display:flex + textTransform:undefined incompatibles avec moteur next/og)

FIX: Worker delivery_loop — ne pas appeler mirror_delivery si mark_delivery_sent a échoué (évite faux positif admin + risque de doublon Telegram au restart)
FIX: Worker whisper_transcriber — try/except sur int(split(":")[1]) pour éviter ValueError/IndexError si premiere_hours manquant
FIX: Worker bot_handler — asyncio.wait_for(timeout=15s) sur les 4 asyncio.gather() pour éviter freeze infini si Supabase hang
FIX: Worker main — audio_url None guard (or "") et voice.split guard si format sans tiret

FEATURE: Admin — funnel d'acquisition visuel (visiteurs→inscrits→trial→pro) + graphiques tendances 30j (visiteurs/inscrits/trials par jour) + intégration PostHog API (POSTHOG_PERSONAL_API_KEY + POSTHOG_PROJECT_ID)
FEATURE: Onboarding wizard — visuels par catégorie (Business/Education/Finance/Science/Tech) : fond dégradé, icône SVG watermark, barre accent colorée

FIX: Worker — détecter la bot-detection YouTube ("Sign in to confirm you're not a bot") dans whisper_transcriber et retourner "youtube_auth_required" (retriable) au lieu de "audio_download_failed" (fail immédiat + notification utilisateur)
FIX: Worker — utiliser player_client=ios dans yt-dlp (sous-titres + audio Whisper) pour contourner la bot-detection YouTube sur les IPs de datacenter

## 2026-02-26

FIX: Worker — ne pas appeler mark_video_failed si mark_video_completed a déjà réussi (évite d'écraser status='completed' en 'failed' sur erreur DB post-traitement)
FIX: Worker — passer language au mark_video_failed dans le handler timeout de _do (évitait d'écraser la mauvaise langue)

FIX: Propager ?annual=true de billing → profile → ProfileContent (defaultInterval prop)
FIX: ADMIN_USER_ID déplacé dans env.ts (suppression constante hardcodée dans profile et admin pages)
FIX: Summaries feed — remplacer Suspense fallback={null} par SummariesFeedSkeleton (3 cartes)
FIX: Onboarding — ajouter error.tsx pour éviter la page Next.js brute en cas d'erreur

FIX: Webhook Stripe — utiliser createAdminClient() pour bypasser RLS (évite silent failures)
FIX: Subscriptions / onboarding — remplacer language "fr" hardcodé par preferred_language du profil
FIX: API lists — retirer created_by (UUID utilisateur) de la réponse publique
FIX: API lists — pousser filtres category/q en DB au lieu de filtrer en mémoire
FEATURE: Onboarding wizard — visuels par catégorie (Business/Education/Finance/Science/Tech) : fond dégradé, icône SVG watermark, barre accent colorée

FIX: Sécurité — supprimer /api/admin/debug (exposait l'ID admin publiquement sans auth)
FIX: Sécurité — /api/test/auth bloquer en production sans exception CI
FIX: Sécurité — /api/newsletter ajouter rate limiting IP (3 req / 10 min)
FIX: Sécurité — /api/demo/summarize corriger extraction IP (x-real-ip > last x-forwarded-for)

FEATURE: Referral section — stats agrégées (Referred / Trial / Pro / Rewarded) sans données personnelles visibles
FEATURE: Referral viral sharing — page /r/[code] exclusive (trial 14j), route /r/[code]/accept, image Story 1080×1920 téléchargeable, bouton Story dans le dashboard
FIX: Referral callback OAuth — use admin client to bypass RLS when reading referrer profile and inserting into referrals table
FIX: site-config freeChannelsLimit 3→5 (cohérent avec l'UI "5 YouTube channels")
FIX: Webhooks stripe cancel/updated/deleted — max_channels hardcodé 3 remplacé par SiteConfig.freeChannelsLimit
FEATURE: pricing-cards — prix dynamiques via /api/stripe/price (plus de hardcoding $9/$79)
FEATURE: pricing-cards, landing/pricing, upsell-modal — défaut "Annual" au lieu de "Monthly"
FEATURE: Badge économies toujours visible — mode monthly → badge amber "Save 27% with Annual" (cliquable), mode annual → badge emerald "You save 27%"
FEATURE: profile-content — sélecteur Monthly/Annual inline dans la section Subscription avec prix dynamique
FEATURE: profile-content — banner "Activating your subscription…" pendant le polling post-paiement
FEATURE: trial-banner — messages urgents progressifs (>3j / ≤3j / dernier jour) + couleur rouge quand ≤3 jours, lien Upgrade pré-sélectionne annuel (?annual=true)
FEATURE: Cron /api/cron/reconcile-subscriptions — réconciliation quotidienne Stripe↔DB à 3h du matin
CHORE: vercel.json — schedulers Vercel Cron pour trial-reminders (9h) et reconcile-subscriptions (3h)

FIX: Worker db.py enqueue_video() — réutilise le slot completed/failed au lieu de bloquer silencieusement les re-soumissions on-demand ; réinitialise attempts=0 et started_at pour éviter un fail immédiat
FIX: Worker db.py enqueue_video_for_language() — réinitialise aussi attempts=0 et started_at quand un slot failed est réutilisé (sinon la prochaine erreur fail le job définitivement)
FIX: Worker telegram_deliverer.py — video_title None causait 'NoneType has no attribute replace' via _html.escape() ; protégé par `video_title or ""`
FIX: Worker telegram_deliverer.py — video_title None causait 'NoneType is not subscriptable' via video_title[:60] et video_title[:40] dans les logs post-send_voice ; protégé par (video_title or '')[:N]
FIX: Worker db.py mark_video_completed() — ajoute paramètre video_title pour backfill les rows créées sans titre (ex. language-chained rows) ; main.py passe video_title à l'appel
FIX: Worker transcript_extractor + whisper_transcriber — "No video formats found!" (erreur yt-dlp pour live en cours) non reconnu comme live → fail permanent + notification user au lieu de snooze 2h

REFACTOR: Worker proxy — stratégie "direct-first" : transcript API + yt-dlp subtitles + téléchargement audio essaient d'abord sans proxy (VPS → YouTube CDN direct), proxy Webshare rotating utilisé uniquement si IP bloquée par YouTube (transcript API uniquement)
FIX: CI — deploy-worker.yml corrige le project-slug Infisical ("brieftube-server-qy7-v" et non "brieftube-server") — Infisical ajoute un suffixe unique au slug
CHORE: CI — deploy-worker.yml fetch VPS_SSH_KEY depuis Infisical (machine identity) au lieu de GitHub Secrets — VPS_HOST hardcodé (IP publique)
CHORE: Worker — MAX_CONCURRENT_VIDEOS 3→12, throttle intelligent (CPU+load+RAM) remplace le simple check CPU
FIX: Referral reward (P0-4) — webhook utilisait createClient() anon/RLS au lieu de createAdminClient(), table referrals retournait 0 rows silencieusement ; lookup redondant remplacé par profile.referred_by
FIX: Landing problem cards — padding équilibré (20px), layout vertical cohérent, inline styles pour contourner le bug Tailwind v4 sur Card py-6/gap-6
FIX: Landing features — "French and English (more coming)" → "55 languages supported" avec liste des principales langues
FEATURE: Landing social proof — barre de stats dynamique (summaries delivered + channels tracked) depuis Supabase, s'affiche uniquement si seuils atteints
FIX: Landing FAQ — prix Pro affichait toujours "…/month?" (data.amount → data.monthly.amount)
FIX: Landing hero — durées audio affichées immédiatement (fallback hardcodé), affiche la durée totale au repos et le temps courant pendant la lecture

FEATURE: Personal stats dashboard (P2-1) — this month, all time, time saved estimate, streak, top channels par activité
FIX: SEO sitemap — supprime doublon sitemap.ts, retire /login (noindex) du sitemap.tsx, ajoute /support manquant
FIX: SEO metadataBase — fixé sur SiteConfig.prodUrl (www.brief-tube.com) au lieu de getServerUrl() qui retournait le domaine Vercel interne, corrige "Google n'a pas choisi la même URL canonique"
FEATURE: SEO sitemap — crée app/sitemap.ts avec pages statiques, articles blog, comparatifs et chaînes (depuis DB), référencé dans robots.ts
CHORE: SEO trailing slash — ajoute trailingSlash: false dans next.config.ts pour éviter les pages dupliquées /page vs /page/
FEATURE: Referral trial emails (P1-5) — email personnalisé J-3/J-1 pour les filleuls en fin de trial, prénom du parrain extrait de l'email, déduplication email_logs, bouton admin
FEATURE: SEO channel pages (P1-3) — /channels index top 100 + enrichissement page chaîne (followers BriefTube, date dernier résumé) + sitemap lastModified dynamique
FEATURE: Re-engagement email (P1-2) — email fondateur aux Pro sans livraison depuis 7 jours, déduplication email_logs, bouton admin
FEATURE: Upsell modal in-app — modal avec toggle Monthly/Annual + checkout direct, déclenché au palier de canaux (activation, bannière amber, ajout en pause)
FEATURE: Plan annuel $79/an — toggle Monthly/Annual sur landing et /pricing, checkout accepte interval, -27% vs mensuel

FEATURE: Activation email — email fondateur personnalisé 24h après signup si Telegram non connecté, question ouverte sur la plateforme préférée
FEATURE: Trial expiry emails — séquence J-3/J-1/expired avec déduplication via email_logs, cron route protégée CRON_SECRET, bouton admin
FEATURE: Posthog — product analytics integration (pageview, user identify, onboarding funnel, cancellation, subscription_activated via server-side posthog-node)

CHORE: VPS — log bot migré du local vers le VPS (service brieftube-log-bot.service + run-log-bot.sh)
CHORE: GitHub Actions — deploy-worker.yml redémarre aussi brieftube-log-bot à chaque déploiement
CHORE: VPS README — documentation complète des services, commandes et architecture (worker + log-bot)
CHORE: VPS setup.sh — installation du service brieftube-log-bot intégrée au script de setup initial

## 2026-02-25

FEATURE: Groq Flex service tier — whisper_transcriber utilise service_tier="flex" (10x quota : 288 000 sec/jour) avec retry automatique sur 498 capacity_exceeded (30s→60s→120s backoff)
FIX: transcript_extractor — VideoUnavailable exception handler passe maintenant par _ytdlp_subtitles avant de déclarer la vidéo indisponible, évite les fausses notifications "could not be processed" pour les lives en cours
FEATURE: Détection musique/ambient en 2 couches — titre (regex haute précision, zéro appel API) dans rss_scanner + catégorie YouTube "Music" (via yt-dlp pre-check) dans whisper_transcriber — évite de gaspiller le quota Groq Whisper sur du contenu non parlé
FEATURE: Log bot — menu slash commands enregistré via setMyCommands (/start, /status, /stats, /watch)
FIX: Log bot — bouton "Alertes live" affiche maintenant ON/OFF selon l'état actif
FIX: Log bot — format du temps humain (6h, 5min, 42s) au lieu des secondes brutes
REFACTOR: Log bot — boucle watch extraite dans _start_watch() pour éviter la duplication
FEATURE: Log bot — mirror des livraisons : chaque vidéo envoyée aux abonnés est copiée une fois (titre + lien YouTube + audio) dans le bot de monitoring admin
FIX: whisper_transcriber — ajout cookiefile et proxy dans ydl_opts (pre-check + download) pour éviter le blocage YouTube "Sign in to confirm you're not a bot"
FEATURE: Worker — endpoint GET /logs sur le serveur HTTP du worker (port 8080), protégé par WORKER_API_SECRET, retourne les 60 dernières lignes de log + status systemd
FEATURE: Admin panel — route /api/admin/worker appelle l'endpoint VPS distant si VPS_WORKER_URL est configuré (fallback local pour dev)
CHORE: env.ts — ajout de VPS_WORKER_URL et WORKER_API_SECRET (optionnels)

CHORE: VPS — documentation complète dans vps/README.md (setup Hetzner, Infisical, GitHub Actions, worker modes, commandes)
FIX: VPS — setup.sh : nouveau dépôt Infisical (artifacts-cli.infisical.com), read interactifs via /dev/tty, authorized_keys pour GitHub Actions, usage scp+ssh -t
CHORE: VPS — run-worker.sh : wrapper Universal Auth Infisical (login → token → run) remplace l'ancien infisical run inline
FIX: VPS — brieftube-worker.service : utilise run-worker.sh au lieu de infisical run inline
CHORE: VPS — GitHub Actions : ajout trigger workflow_dispatch + déclenchement sur vps/**, daemon-reload avant restart
FIX: VPS — sudoers brieftube : ajout de systemctl daemon-reload dans les permissions NOPASSWD
CHORE: VPS — MAX_CONCURRENT_VIDEOS passé de 2 à 3 slots (VPS + local)
CHORE: Local — service systemd local configuré en WORKER_MODE=processor WORKER_INSTANCE=1 (pas de bot Telegram, pas de RSS)

FEATURE: Worker — mode WORKER_MODE=processor pour instances parallèles (scale horizontal) : _NullAlert, processor_main(), HEALTH_PORT+WORKER_INSTANCE, WORKER_MODE env var ; template systemd brieftube-processor@.service
CHORE: Worker — WebSub : log URL callback au démarrage + warning si APP_URL local
CHORE: VPS — ajout du workflow GitHub Actions deploy-worker.yml (auto-deploy sur push main/worker/**) + script setup.sh + template systemd pour Hetzner
CHORE: Worker — CPU optimization: replace libmp3lame (MP3 64kbps) with libopus in yt-dlp audio download (2-3x faster encoding); reduce MAX_CONCURRENT_VIDEOS from 3 to 2 via systemd drop-in override
FIX: Worker — multi-language bug: when a channel had FR + EN subscribers, only FR was processed (enqueue_video created 1 job); EN rows stayed "pending" indefinitely; fix: after completing language X, worker now detects other pending languages and re-queues the same job slot for the next language (chain processing)
FIX: Worker — DB repair: 56 orphaned "pending" EN jobs re-queued via migration requeue_multilang_orphaned_pending_videos
FIX: Worker — "Premieres in X hours" yt-dlp error not matched by _PREMIERE_RE (pattern only covered "premiere will begin", not verb form); added "premieres? in \d+" to _PREMIERE_RE and updated _hours_until_premiere to parse "Premieres in X hours/days/minutes" in both transcript_extractor.py and whisper_transcriber.py
FIX: Worker — DB repair: sync processed_videos.status for permanently failed jobs (reset_stuck_processing_jobs could set job to "failed" without calling mark_video_failed); migrations sync_failed_status_pending_videos + sync_failed_status_language_mismatch

FIX: Account deletion — cancel Stripe subscriptions via customer ID fallback when stripe_subscription_id is missing (prevents orphaned active subscriptions)
FEATURE: Google Ads — fire conversion event on Pro activation (gtag trackAdConversion via NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL); clear ?success=true from URL after success to prevent re-firing

## 2026-02-24

FIX: Stripe — billing page now passes ?success=true to profile, shows Pro toast on activation, auto-refreshes if webhook hasn't processed yet
FIX: Worker — "Error opening output files: Invalid argument" (ffmpeg live stream postprocessing failure) now caught as audio_unsupported_format → permanent silent skip, no user notification
FIX: Worker — add max_filesize 150 MB to yt-dlp opts in _download_audio to abort infinite HLS live downloads before 20-min timeout kicks in
FIX: Worker — transcript_too_short caused infinite retry loop (not treated as immediate failure); now skips permanently and silently like music videos
FIX: Worker — Whisper _download_audio now pre-checks live_status before downloading, preventing 18-min HLS infinite stream download that caused false failure notification
FIX: Worker — upcoming lives (live_status=is_upcoming) not detected by is_live check; now uses live_status + scheduled_start_time for accurate snooze duration
FIX: Worker — _hours_until_premiere ignored "days" unit ("begin in 7 days" → 2h snooze); now correctly converts days to hours
FEATURE: Admin — newsletter seed button to sync all existing DB users to Resend audience
FEATURE: Auth callback — auto-add new signups to Resend newsletter audience

FEATURE: Footer — real logo, Product/Legal columns, Support link, newsletter signup (Resend contacts API)

FEATURE: Support/Privacy/Terms — shared layout with Navbar + Footer via (legal) route group, improved support page style
FIX: Worker — ffmpeg chunk split used -q:a 0 (VBR ~220kbps) instead of -c copy, causing each chunk to be ~55 MB and triggering Groq 413 despite splitting; fixed with stream copy
FIX: Worker — detect live streams (is_live info dict + error patterns) and snooze silently 2h instead of failing with user notification; covers transcript_extractor, whisper_transcriber and main processor
CHORE: Landing — remove all open source / self-host / GitHub references (navbar star button, pricing self-host paragraph, final CTA secondary button, footer GitHub & Contribute links)
FEATURE: Cancel flow — modal multi-étapes (raisons → offre irrésistible −50% 3 mois → confirmation), stockage feedback en DB, section churn dans admin

FIX: Lists — follow/star counts always showed 0 due to RLS policies filtering to current user only; now uses adminClient for count queries to bypass RLS
FIX: Worker — cleanup_undeliverable_deliveries() now deletes deliveries for skipped videos instead of marking them failed (pre-subscription skips are intentional, not errors)
FIX: Worker — fix "not enough values to unpack (expected 3, got 2)" crash in transcript_extractor._ytdlp_subtitles (line 352 missing third None in early return)
FEATURE: Worker — detect premiere/scheduled YouTube videos (yt-dlp "live event will begin in Xh"), snooze job with retry_after instead of failing permanently, no false failure notification sent to users
FIX: Worker — add nocheckcertificate to yt-dlp options in transcript_extractor and whisper_transcriber to fix SSL CERTIFICATE_VERIFY_FAILED errors
FIX: Worker — increase VIDEO_TIMEOUT from 600s to 1200s to handle long videos requiring Whisper fallback; reset Om1Mys0AIa8 to queued for reprocessing
FIX: Stripe — patch stripe_customer_id null for user D (cus_REDACTED) and manually send upgrade confirmation email

FIX: Stripe webhook — fallback to metadata.userId when stripe_customer_id is null, always save customer ID and update max_channels on subscription events
FIX: Stripe portal — fallback lookup by email when stripe_customer_id is missing, show manage billing button for all active subscribers

CHORE: Add logo-hd.png (512x512) and logo-120.png (120x120) for Google OAuth consent screen
FIX: Privacy policy — add YouTube API Services Privacy Policy link (required for Google OAuth verification) and unify contact email to contact@brief-tube.com

FIX: Anti-abuse — block free trial on re-signup after account deletion (deleted_accounts table + check in both OAuth callbacks)
FEATURE: Landing pages variants — add 5 static ad-targeted landing pages at /lp/[variant] (commuter, backlog, speed, niche, telegram) with noindex metadata and UTM-tracked CTAs to /login

UX: Landing — reduce section padding on mobile (py-20 → py-14 md:py-20) for consistent vertical spacing; fix HowItWorks mt-16 → mt-12 md:mt-16; standardize Demo section
UX: Hero — increase mobile top padding (pt-20 → pt-28) to add breathing room between floating navbar and title
FEATURE: Landing hero — replace Fireship video with Simon Sinek TED talk, add YouTube thumbnail as semi-transparent card background
FEATURE: Telegram bot — add "Summary" button in Options menu to display the full text summary
CHORE: SEO — sitemap étendu avec /blog, /blog/[slug], /vs, /vs/[slug] (statiques) et /channels/[channel_id] dynamiques (unique channel_ids depuis subscriptions)
FEATURE: Admin panel — add 6 new metric sections (MRR, active users 7d, signups 14d, growth chart, referral conversion, top channels, language distribution)
FEATURE: SEO — generateMetadata for /lists/[id] with OG images, canonical URLs, and dynamic descriptions from list metadata
FEATURE: SEO — public pricing page with metadata, "Start free trial" button for unauthenticated users
FEATURE: SEO — sitemap includes public lists with /pricing entry, dynamic lastModified from list creation date
FEATURE: Blog — add complete SEO blog system with 3 long-form articles (YouTube info overload, best channels, setup guide), blog index with card grid, and article details with JSON-LD schema and CTA
FEATURE: SEO — add programmatic channel pages at /channels/[channel_id] showing 20 latest AI summaries with metadata
FEATURE: SEO — create comparison pages at /vs (Eightify, NoteGPT) with feature tables, verdicts, and JSON-LD schema
CHORE: copywriting — humanisation du texte landing page (hero, problem, features, pricing, FAQ, CTA) pour améliorer le SEO et la crédibilité perçue
CHORE: SEO — robots.ts disallow /dashboard /api /auth /onboarding pour économiser le crawl budget
CHORE: SEO — sitemap ajoute /privacy et /terms, supprime /pricing (page protégée), lastModified statiques
CHORE: SEO — layout.tsx title template (%s — BriefTube), robots googleBot maxSnippet/maxImagePreview, OG siteName/locale, Twitter site handle
CHORE: SEO — page.tsx JSON-LD enrichi : SoftwareApplication avec offres Free+Pro, Organization schema, FAQPage schema (4 Q&A)
CHORE: SEO — login/layout.tsx : metadata noindex pour la page de connexion (client component)
CHORE: SEO — terms/page.tsx et privacy/page.tsx : metadata title/description/canonical
CHORE: SEO IA — public/llms.txt : fichier de découverte pour les LLMs (ChatGPT Search, Perplexity, Claude, etc.)
CHORE: worker — fix cleanup_audio_files fréquence : appelé toutes les 10 min (counter 40 cycles) au lieu de chaque cycle de livraison
FEATURE: worker — persistance WorkerStats dans Supabase (table worker_stats) ; restauration des compteurs au démarrage, sauvegarde toutes les 5 min + à l'arrêt

## 2026-02-23

FEATURE: Admin panel — add conversion funnel (free/trial/pro/churned), trials expiring in 7 days list, and at-risk users (Telegram connected, active channels, no deliveries in 7 days)
CHORE: worker — 5 optimisations de performance : RSS scanner parallèle (ThreadPoolExecutor 50 workers, 50x plus rapide) ; get_all_known_video_ids() fenêtrée 30 jours (96% réduction mémoire) ; create_deliveries_for_video() batch insert O(1) au lieu O(N) ; delivery_loop fetchPending 10→30 avec sleep 1s→0.05s (30x accélération) ; health check HTTP GET /health :8080 pour monitoring externe
CHORE: worker — MAX_CONCURRENT_VIDEOS 2→6, RSS_CHECK_INTERVAL 300→1800s (WebSub gère le temps réel) ; fail_job/mark_video_failed avec immediate=True pour échec permanent sans retry sur erreurs déterministes ; WebSub sync parallèle (semaphore 50 au lieu de séquentiel 0.1s/channel)

UX: profile — bouton Admin panel visible uniquement pour l'admin (isAdmin prop + ShieldAlert icon)

FIX: worker — cleanup_undeliverable_deliveries inclut désormais les vidéos "skipped" (pas seulement "failed") ; 2860 livraisons bloquées nettoyées en DB
FEATURE: WebSub (YouTube Push Notifications) — élimine le polling RSS intensif (726 req/5min → push instantané) ; table websub_subscriptions, route GET+POST /api/webhooks/youtube avec vérification HMAC-SHA1, worker websub_manager.py (subscribe + renouvellement toutes les heures), RSS fallback inchangé
CHORE: types Supabase régénérés — ajout websub_subscriptions + colonne language sur deliveries


FIX: onboarding/follow-list + lists/follow — pre-mark existing channel videos as skipped before inserting subscriptions (prevents historical videos from being queued as new deliveries)
CHORE: worker — service systemd Infisical corrigé (bon projectId brieftube-server + path /worker) ; boto3 installé dans Python 3.12 du venv
CHORE: worker — migration Supabase Storage → Cloudflare R2 pour les fichiers audio (zero egress cost) ; storage.py, config R2, migrate_audio_to_r2.py

FEATURE: Auth — custom Google OAuth flow via brief-tube.com/api/auth/google (bypass Supabase redirect domain) with CSRF state, id_token exchange, and preserved trial/referral logic

UX: scrollbars — style global fin et sombre (4px, rgba blanc/12%) sur toute l'app ; nettoyage des classes inline redondantes

UX: landing — réduction du padding mobile (pt-36→pt-20), suppression du badge et du social proof
UX: onboarding — dots de progression dans le header avec le logo ; suppression des grandes icônes par étape

FIX: bot — suppression complète de la limite de partage (3/jour) ; get_profile_by_telegram ne retournait pas trial_ends_at donc les utilisateurs en trial étaient traités comme Free
FIX: bot — utilisateurs en période d'essai (trial_ends_at) considérés comme Pro pour toutes les limites (partage, canaux, résumés on-demand) ; seul subscription_status="active" était vérifié auparavant
UX: bot — menu Options : suppression du bouton Language ; bouton Unsubscribe demande confirmation avant de se désabonner ([Yes, unsubscribe] / [Cancel])

FIX: bot — abonnement via Telegram (bouton Subscribe ou lien de chaîne) stocke maintenant l'avatar YouTube en scrappant la page de la chaîne ; l'image apparaît correctement dans l'interface web
UX: share — header avec logo et bouton Sign in sur la page de partage
UX: bot — menu Options affiche uniquement Subscribe OU Unsubscribe selon l'état d'abonnement actuel (plus les deux boutons simultanément) ; si chaîne inconnue, aucun bouton affiché
FIX: bot — boutons Subscribe/Unsubscribe depuis Options fonctionnent désormais pour les vidéos on-demand (channel_id="" en DB) : fallback scraping de la page YouTube pour extraire channelId et channel_name
UX: bot — picker de langue share : édite le clavier en place (pas de nouveau message, pas de texte d'explication) ; après sélection, le message revient à l'URL + [Language][Share →] ou affiche le statut de génération
UX: bot — bouton langue sur le message de partage renommé "Language" (plus clair que le nom de la langue courante)
UX: bot — message du lien de partage dispose maintenant d'un bouton "Share →" qui ouvre le sélecteur de contacts/groupes Telegram natif pour transférer le lien directement
UX: bot — bouton Options remplace le clavier du message existant en place (edit_reply_markup) au lieu d'envoyer un nouveau message "Options:" dans le chat
UX: bot — share language picker affiche toutes les langues supportées (pas seulement les disponibles) ; les déjà générées marquées avec *, la courante avec ✓ ; choisir une langue non disponible déclenche la génération du résumé dans cette langue puis livre l'audio
UX: bot — bouton Share affiche uniquement l'URL (propre, sans texte superflu) + bouton langue en dessous ; cliquer sur la langue ouvre un picker ; choisir une autre langue génère un nouveau lien de partage dans cette langue et reçoit le résumé
FIX: worker — latence bot : psutil.cpu_percent(interval=1) bloquait l'event loop 1 seconde entière à chaque check CPU ; déplacé dans asyncio.to_thread() pour libérer l'event loop pendant la mesure
FIX: worker — latence bot : get_pending_deliveries(), mark_delivery_sent(), mark_delivery_failed() dans delivery_loop appelés sans asyncio.to_thread() — bloquaient l'event loop à chaque livraison
FIX: bot — latence boutons : tous les appels DB synchrones dans les callback handlers (get_profile_by_telegram, get_processed_video, get_or_create_share) déplacés dans asyncio.to_thread() ; handle_share_callback parallélise les 2 fetches indépendants avec asyncio.gather()
FEATURE: worker — récupération automatique des livraisons échouées toutes les 10 min : si la vidéo est maintenant completed avec audio et que la livraison a sent_at=NULL, elle est remise en pending automatiquement
FIX: worker — bot polling : keepalive_timeout=60 au lieu de force_close=True pour réutiliser les connexions SSL existantes (évite un handshake de 6s par cycle de polling)
FIX: worker — upsert livraison ne remettait pas sent_at à NULL sur conflit (user_id, video_id), laissant la livraison bloquée en 'failed' pour toujours ; remplacé par UPDATE explicite + INSERT si absent
FIX: worker — bot polling Telegram recréait pas la session aiohttp après des erreurs réseau répétées ; session TCP maintenant recréée après 3 échecs consécutifs + force_close=True pour éviter les stale connections
FIX: worker — limite CPU throttle passée de 65% à 90% (Chrome en fond saturait la limite système, bloquant tout traitement vidéo alors que le worker consommait seulement 2%)
FEATURE: worker — détection automatique des vidéos musicales/ambient (titres avec Hz/binaural/méditation/etc.) pour bloquer Whisper inutilement ; aussi blocage si audio > 80 MB après téléchargement
FIX: worker — voix TTS automatiquement ajustée à la langue cible si la voix configurée ne correspond pas (ex: voix française sur résumé arabe → ar-SA-ZariyahNeural)
FIX: worker — reset_stuck_processing_jobs capture aussi les jobs avec started_at=NULL (bloqués indéfiniment car filtre SQL started_at < cutoff exclut les NULL)
FIX: worker — import manquant InlineKeyboardButton/InlineKeyboardMarkup dans bot_handler.py causait NameError sur le menu Options
FIX: db — 8 vidéos débloquées manuellement (6 orphelines sans job dans processing_queue, 2 bloquées en processing, 2 job completed mais processed_videos toujours pending)
FEATURE: bot — menu Options avec 4 boutons (Partager, Langue, S'abonner, Se désabonner) accessible via le bouton "⚙️ Options" sur chaque résumé livré
FEATURE: bot — collage d'un lien de chaîne YouTube : vérifie l'abonnement et propose Abonner/Désabonner avec boutons inline au lieu de s'abonner immédiatement
UX: bot — bouton renommé "⚙️ Options" (au lieu de "⚙️" seul)
FIX: bot — token Telegram régénéré (conflit 409 causé par processus bun externe sur /home/vj/claude-telegram-bot)
FEATURE: worker — add 6 new database functions for channel/subscription management (get_video_channel, get_available_languages_for_video, is_subscribed_to_channel, unsubscribe_channel, subscribe_to_channel, get_subscription_count)
UX: share — bouton de vitesse x1/x1.5/x2/x3/x4 sur le lecteur audio de la page de partage
UX: share — audio avant le résumé texte sur la page de partage

## 2026-02-22

CHORE: worker — supprime save_cookies.py, cookies/gemini_session.json, cookies/browser_profile/ et playwright de requirements.txt (browser automation Gemini obsolète, remplacé par API directe)

FIX: bot — /status affiche Trial · Xd left au lieu de Free (utilisait sa propre logique au lieu de _get_plan_label)
FIX: bot — ajout de logs dans handle_message et handle_video_request pour tracer les messages reçus et le cheminement des demandes on-demand
FIX: bot — bouton ⚙️ fonctionnel : query.answer() expirée ignorée gracieusement (share link envoyé quand même), log au démarrage du handler, error handler avec traceback complet
UX: bot — menu commandes Telegram enregistré (bouton "/" à gauche) : /start, /status, /help
FIX: bot — /start affiche Trial · Xd left au lieu de Free quand l'utilisateur est en période d'essai (vérifie trial_ends_at)
FIX: bot — bouton ⚙️ : allowed_updates forcé à inclure callback_query au démarrage, fix parsing callback_data avec rpartition pour video IDs avec underscore, /start reconnait les utilisateurs déjà connectés, message "non connecté" avec lien direct vers profil
UX: profil — bouton "Reconnect" Telegram toujours visible même quand déjà connecté (permet de régénérer le lien magic) (getUpdates explicite avant polling), fix parsing callback_data avec rpartition pour video IDs avec underscore, /start reconnait les utilisateurs déjà connectés
FIX: bot — livraison en 2 messages liés : texte + preview YouTube inline (send_message + LinkPreviewOptions), puis voice OGG/OPUS en reply (waveform + vitesse 1×/1.5×/2× + bouton Options) ; anti-doublons : pas de retry sur send_voice
FIX: logo — logo.svg et avatar Telegram mockup (hero.tsx) mis à jour avec le vrai logo (double flèches accélérées) au lieu de l'ancien "B>" ; avatar rounded-xl pour matcher le favicon
UX: bot — livraison en message unique (send_audio) au lieu de photo + voice reply ; miniature YouTube, titre et bouton Options dans le même message
FIX: worker — résilience complète aux redémarrages : reset des jobs processing bloqués (started_at + timeout), claim isolé du send dans le delivery loop (erreur DB sur claim = retry, pas failed), erreur d'envoi transiente laisse 'sending' pour recovery au prochain démarrage
FIX: DB — contrainte deliveries_status_check étendue à 'sending' (manquait) → les livraisons Telegram étaient bloquées depuis l'ajout du claim atomique
UX: bot — confirmation immédiate dès réception d'une URL YouTube (avant l'appel oEmbed), plus de délai apparent pour l'utilisateur
CHORE: log bot sous systemd (brieftube-log-bot.service) — protection instance unique exhaustive : fcntl flock OS-level + PID file avec takeover SIGTERM/SIGKILL
FIX: worker/bot_handler.py — les alertes admin (startup, erreurs, stats) passent désormais par le log bot (LOG_BOT_TOKEN) au lieu du bot public principal
FIX: follow-list/route.ts — faille sécurité : free users pouvaient obtenir un nombre illimité d'abonnements actifs via l'onboarding ; désormais limités à max_channels
CHORE: DB — désactivation des 224 abonnements abusifs de a power user's account (226 → 2 actifs) + suppression de 1715 jobs zombies dans processing_queue (attempts=0, status=failed)

UX: Landing — nm-raised sur mockup Telegram hero, cartes features, cartes pricing, FAQ accordéons et icônes how-it-works ; boutons CTA rounded-full
UX: Login — Card remplacée par nm-raised rounded-2xl ; logo favicon SVG centré à la place du "B"
UX: Pricing page — cartes plans nm-raised rounded-2xl avec badge "Most popular" nm-raised-sm ; boutons rounded-full
UX: Shared summary — sections nm-raised rounded-2xl pour header/summary/audio/CTA ; language picker nm-inset/nm-raised-sm rounded-full
UX: Lists [id] — top bar sticky transparent glass ; badge catégorie nm-raised-sm ; container chaînes nm-raised rounded-2xl ; avatars fallback nm-inset-sm
UX: Followed lists — container nm-raised rounded-2xl ; en-tête section uppercase
UX: Worker card (admin) — status nm-raised rounded-2xl ; boutons rounded-full ; logs nm-raised rounded-2xl
UX: Edit list form — restructure en sections nm-raised rounded-2xl avec en-têtes uppercase (pattern profil) : Details (Name + Description + Category) + Channels ; supression du h1 redondant
UX: Dialogs — nm-raised sur AlertDialogContent + DialogContent (rounded-2xl), inputs nm-inset, boutons action/cancel rounded-full
UX: Nav — top bar transparent glass (bg-[oklch(0.18)]/60 + backdrop-blur-2xl + border-b subtile), même style que la bottom nav
UX: Nav — favicon.svg recentré (triangles centrés dans le carré rouge) ; search bar rounded-full + bg-white/[0.07] + border-white/[0.12] pour meilleure visibilité
UX: Nav — logo remplacé par favicon.svg (double play triangle / accéléré) à 30px ; search bar plus visible (placeholder /60, bg-white/[0.03], border subtile)
UX: Profile page — avatar nm-inset-sm, boutons Delete/Sign out/Change/Connect/Upgrade → rounded-full + nm-raised-sm, boutons de partage rounded-full, suppression des border en doublon sur VoicePicker et LanguagePicker
UX: Mobile bottom nav — island nm-raised (fond solide oklch(0.24) + shadow forte), onglet actif nm-inset rouge, style Telegram-inspired neumorphique : fond semi-transparent + backdrop-blur-2xl, coins arrondis, marges latérales, actif = pill rouge subtil
UX: Lists — scrollbar des catégories cachée par défaut, visible seulement au survol (classe .scrollbar-fade-x cross-browser webkit + Firefox)
FEATURE: Dark neumorphic style — apply reinforced nm- classes to remaining components: lists-section (empty state + list rows), onboarding-stepper (wrapper, step cards, progress track, badges), admin page (StatCard, Live badge, queue and failures containers)
FEATURE: Dark neumorphic style — apply .nm-raised/.nm-inset utility classes to onboarding-wizard (step icons, buttons, inputs, language grid, connected card, share buttons, instructions card, badges)
FEATURE: Partage viral de résumés — bouton "⋯ Options" sur chaque livraison Telegram génère un lien public /s/{short_id} ; page publique avec résumé, audio et CTA d'inscription ; limite 3 partages/jour (free) et 100 vues/lien
CHORE: Migration DB — table shared_summaries (short_id, video_id, language, shared_by, view_count, max_views, expires_at)
FIX: supabase.ts — ajout colonne language dans processed_videos et table shared_summaries

FEATURE: Dark neumorphic style — classes utilitaires .nm-raised/.nm-inset dans globals.css, appliquées sur nav (top bar + bottom tabs + search input), Lists, dashboard principal et profil
UX: Lists page — supprime le titre "Lists" redondant, déplace "New list" en lien texte inline à côté de la section "Mine"
FIX: onboarding-wizard — "Waiting for connection..." masqué jusqu'au clic sur "Open BriefTube Bot" (hasClickedBot state)
FEATURE: subscriptions/route.ts — support des URLs de vidéos YouTube (watch?v= et youtu.be/) via oEmbed : détecte la chaîne automatiquement et résume la vidéo spécifique au lieu de la dernière
FEATURE: Emails transactionnels — email de bienvenue au premier login (auth/callback), email de confirmation upgrade Pro (webhook checkout.session.completed), email de paiement échoué (webhook invoice.payment_failed)
FEATURE: Notification Telegram sur échec définitif de vidéo — fail_job() retourne bool, _notify_video_failure() notifie tous les users concernés via Telegram après 3 tentatives
FEATURE: Suppression de compte RGPD — route DELETE /api/account/delete (annule Stripe, supprime toutes les données, supprime l'auth user via service role); bouton "Delete account" dans profile-content.tsx avec confirmation dialog

REFACTOR: Lists page — remove redundant Following section, compact categories to single horizontal scroll row, add All/Following/Not following filter chips
UX: Lists page — replace star/favorite count with follower count (Users icon) on public discovery lists, sorted by most followed
FIX: onboarding/follow-list — skip channels that don't resolve to a valid UC ID (startsWith "UC", length 24) to prevent inserting invalid channel handles
FIX: DB — fix invalid handles in curated lists: verge→TheVerge, thedankoe→AlexHormozi
FIX: onboarding/follow-list + completeOnboarding — use createAdminClient() for DB ops after user verification; fixes 500 caused by session/cookie not properly attached to anon client in API route/server action context
FIX: onboarding-wizard — complete() uses server action (completeOnboarding) to reliably update onboarding_completed; browser client was failing silently causing redirect loop
UX: Onboarding step 3 — rename "Connect Telegram" to "Link Telegram" (less intimidating), clearer explanation + reassurance note
UX: Onboarding step 2 — custom styled scrollbar on language grid (thin 4px, transparent track, rounded white thumb)
FEATURE: Netflix-style onboarding — step 1 replaced by curated list picker (Tech, Science, Finance, Education, Gaming, Business); user picks a playlist, channels are subscribed via /api/onboarding/follow-list (no Pro check, handles resolved to real channel IDs); YouTube import and manual add kept as secondary options

## 2026-02-21

FIX: SummariesFeed — memoize supabase client with useMemo to stop infinite re-render loop (createClient() was returning a new instance each render, invalidating useCallback/useEffect chain)

FIX: Move admin dashboard from /admin to /dashboard/admin — eliminates persistent redirect bug by reusing the reliable dashboard layout instead of a standalone layout with its own auth guard

FIX: worker/db.py — enqueue_video: check all statuses (not just queued/processing) to avoid 23505 duplicate key on already-completed videos; create_deliveries_for_video: replace upsert(on_conflict) with select+insert to avoid 42P10 (no unique constraint on deliveries table)
FIX: worker/rss_scanner.py — also catch 42P10 errors in known_video_ids to prevent deleting processed_videos entry and causing infinite re-detection loop
FEATURE: worker — atomic security: PID file (_enforce_single_instance) kills stale worker processes at startup; claim_delivery atomically transitions pending→sending so concurrent instances cannot double-send; reset_sending_deliveries recovers stuck claims on startup
FIX: worker/db.py — duplicate deliveries: deduplicate user_ids in create_deliveries_for_video (same user subscribed via multiple paths), select language in get_pending_deliveries, deduplicate by (user_id, video_id) before sending
FIX: worker/main.py — double logging: StreamHandler now only added when running manually (no INVOCATION_ID), preventing duplicate lines when systemd redirects stdout/stderr to worker.log
FEATURE: Add /admin dashboard — worker status (systemd + logs + start/stop/restart), user stats, 24h activity, processing queue and recent failures; protected by admin user ID; polls every 10s via TanStack Query

## 2026-02-20

REFACTOR: delivery-section — simplify voice selection to one female + one male voice per language (37 languages covered); languages without a known male counterpart keep a single default voice

FIX: gemini_api — cap résumé à 800 mots max (AUDIO_MAX_WORDS) pour éviter troncature mid-sentence sur vidéos longues ; ajout instruction "sois sélectif" pour transcriptions > 4500 mots (~30 min) ; prompt migré en anglais pour meilleure fiabilité du modèle

FIX: VoicePicker — replace nested `<button>` inside `<button>` with `<div role="button">` to fix hydration error (invalid HTML)


CHORE: worker — os.nice(10) au démarrage + throttle CPU actif (pause si CPU > MAX_CPU_PERCENT, défaut 65%) avant chaque nouveau job ; MAX_CONCURRENT_VIDEOS réduit à 2 par défaut ; tout configurable via .env
FIX: Import YouTube — pre-marking videos as skipped now uses correct `onConflict: "video_id,language"` and includes the `language` sentinel field to prevent silent upsert failures that caused all historical videos to be treated as new and delivered to the user
FIX: subscriptions/route.ts — "aha moment" upserts now include `language` (preferred_language du profil) et correct `onConflict: "video_id,language"` pour processed_videos ; processing_queue utilise check+insert sans fausse contrainte unique ; deliveries incluent language
FIX: lists/follow/route.ts — erreurs Supabase des DELETE (unfollow) et INSERT (follow) désormais vérifiées et retournées au lieu d'être ignorées silencieusement

CHORE: dialog — softer border (border-white/[0.06]) and rounded-xl to match app style
FIX: dialog-component — custom dialogs now close on outside click (missing onOpenChange handler)
FIX: dialog-component — add AlertDialogTitle and aria-describedby={undefined} to custom dialogs to fix Radix UI accessibility warnings
FEATURE: Voice picker — add play preview button (Web Speech API) and replace language labels with tone descriptors
FEATURE: Add language picker in account settings — users can switch summary language (+ TTS voice) directly from the Delivery section
REFACTOR: Extract 56-language list to shared `src/lib/languages.ts`, imported by onboarding wizard and delivery settings
REFACTOR: Redesign profile page — single-row account card with avatar, voice picker in dialog, compact subscription CTA, uniform section headers
FIX: Worker multi-langue — les résumés sont désormais générés dans la langue préférée de chaque abonné (était toujours 'fr' à cause du DEFAULT DB)
FIX: DB migration — ajout colonne language sur processed_videos (unique sur video_id+language) et deliveries
FIX: rss_scanner — enqueue un job par langue unique parmi les abonnés (plus de langue partagée entre tous)
FIX: db.py — enqueue_video/insert_new_video/mark_video_completed/mark_video_failed/create_deliveries_for_video/get_pending_deliveries supportent maintenant la langue
FIX: bot_handler — on-demand via Telegram utilise la preferred_language du profil utilisateur

FEATURE: SEO — fix sitemap URLs to use SiteConfig.prodUrl, add robots.ts, enrich layout with OG/Twitter metadata
FEATURE: SEO — add opengraph-image.tsx dynamic OG image (1200×630) via next/og
FEATURE: SEO — add canonical + JSON-LD SoftwareApplication schema on landing page
FEATURE: Referral — add Web Share/X/Telegram share buttons in referral section (dashboard settings)
FEATURE: Referral — show share CTA with X/Telegram buttons after Telegram connect in onboarding (delay 2s→4s)
FEATURE: Referral — fetch referral_code in onboarding page and pass to wizard
FEATURE: Referral — notify referrer via Telegram when someone signs up with their link (auth/callback)
FEATURE: Worker — include referral link in Telegram bot welcome message on /start connect

FIX: Batch channel POST in chunks of 50 in edit-list-form — fixes 400 error when importing 226+ subscriptions into a list (API has .max(50) Zod limit)
UX: Move Save button to sticky top bar in edit-list-form — no longer requires scrolling past 200+ channels to save

REFACTOR: Move default voice/language to SiteConfig — onboarding/page.tsx now uses SiteConfig.defaultTtsVoice instead of hardcoded string, DB default kept in sync
FIX: Change default tts_voice to en-US-JennyNeural and preferred_language to en in DB — new users now get English pre-selected in onboarding
UX: Add "Later" button on onboarding step 1 — allows skipping channel import and continuing to step 2
UX: Replace voice selection with comprehensive language selection in onboarding step 2 — 56 languages with native names, searchable grid, saves both tts_voice and preferred_language to profile
UX: Remove profile icon and plan badge from top-right nav — profile accessible via bottom tab bar and desktop nav links
UX: Rewrite trial-banner with useSyncExternalStore — dismissable via localStorage, re-appears after 7 days, always shows in last 3 days
UX: Move search bar inline on mobile — same row as logo, remove second row below nav
UX: Channel list — Pause/Play icon for toggle, always-visible Trash icon for remove

UX: Move search/add channel bar to nav header — desktop center, mobile second row, synced via nuqs URL param
UX: Dashboard design pass — compact trial banner, text-link import, dot status indicator, text-only show-more, clean header
UX: Improve search/add bar visibility in Sources section — brighter border, background, and placeholder

FIX: Create src/lib/icons.tsx barrel wrapping all Lucide icons with suppressHydrationWarning — eliminates Dark Reader SVG hydration mismatches
FIX: Add suppressHydrationWarning to all next/image <Image> components — eliminates Dark Reader inline-color hydration mismatches
FIX: Wrap SectionErrorBoundary children in Suspense inside render() — fixes React 19 "uncached promise" error for RSC thenable children
FIX: Remove async from SectionErrorBoundary.render() — fixes "uncached promise" React error
FIX: Add color-scheme to CSS + enableColorScheme on ThemeProvider to prevent Dark Reader SVG hydration mismatch
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
