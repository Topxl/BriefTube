/**
 * BriefTube Curator — CLI d'administration du contenu d'un utilisateur.
 *
 * Réutilise la logique de production (getYouTubeChannelInfo, queueVideoForProcessing)
 * pour agir directement en DB avec la clé service role, sans passer par les
 * routes API authentifiées. Pensé pour être piloté par un agent (Claude Code).
 *
 * Usage :
 *   pnpm exec tsx scripts/curator.ts profile [--user <email|uuid>]
 *   pnpm exec tsx scripts/curator.ts list [--user ...]
 *   pnpm exec tsx scripts/curator.ts add-channel <@handle|url|UCid> [--paused] [--aha] [--user ...]
 *   pnpm exec tsx scripts/curator.ts remove-channel <UCid|nom> [--pause] [--user ...]
 *   pnpm exec tsx scripts/curator.ts add-video <url|videoId> [--title "..."] [--user ...]
 *
 * Par défaut le user cible est ADMIN_USER_ID (.env.local).
 */
/* eslint-disable no-console */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import path from "node:path";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
config({ path: path.join(repoRoot, ".env.local") });

// Importés APRÈS dotenv pour que les modules qui lisent process.env soient servis
import { getYouTubeChannelInfo, fetchVideoOembed } from "@/lib/youtube";
import { extractVideoId } from "@/lib/youtube-id";
import { queueVideoForProcessing } from "@/lib/video-queue";

const YOUTUBE_CHANNEL_ID_RE = /^UC[a-zA-Z0-9_-]{22}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SubscriptionRow = {
  id: string;
  channel_id: string;
  channel_name: string;
  active: boolean | null;
  source_type: string | null;
  created_at: string | null;
};

type ProfileRow = {
  id: string;
  email: string | null;
  subscription_status: string | null;
  max_channels: number | null;
  preferred_language: string | null;
  telegram_connected: boolean | null;
};

function fail(message: string): never {
  console.error(`Erreur: ${message}`);
  process.exit(1);
}

function makeAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    fail(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants (.env.local)",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function resolveUserId(
  supabase: SupabaseClient,
  userArg: string | undefined,
): Promise<string> {
  const target = userArg ?? process.env.ADMIN_USER_ID;
  if (!target) {
    fail(
      "aucun user cible — passe --user <email|uuid> ou définis ADMIN_USER_ID",
    );
  }
  if (UUID_RE.test(target)) return target;
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", target)
    .maybeSingle();
  if (error) fail(`lookup profil "${target}": ${error.message}`);
  if (!data) fail(`aucun profil avec l'email "${target}"`);
  return (data as { id: string }).id;
}

async function getProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileRow> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, email, subscription_status, max_channels, preferred_language, telegram_connected",
    )
    .eq("id", userId)
    .single();
  if (error) fail(`fetch profil: ${error.message}`);
  return data as ProfileRow;
}

/**
 * Résout n'importe quelle entrée (handle, URL de chaîne, URL de vidéo, UC id)
 * vers un vrai channel ID UC via la même logique que la prod.
 */
async function resolveChannel(input: string): Promise<{
  channelId: string;
  channelName: string;
  channelAvatarUrl: string;
}> {
  const trimmed = input.trim();

  // URL de vidéo → on passe par le oEmbed pour retrouver le handle
  const videoId = /watch\?v=|youtu\.be\/|\/shorts\//.test(trimmed)
    ? extractVideoId(trimmed)
    : null;
  if (videoId) {
    const oembed = await fetchVideoOembed(videoId);
    const handle = oembed?.author_url.match(/@([a-zA-Z0-9_.-]+)/)?.[0];
    if (!handle)
      fail(`impossible de résoudre la chaîne depuis la vidéo ${videoId}`);
    return getYouTubeChannelInfo(handle);
  }

  // URL de chaîne ou handle brut → extraire @handle ou UC id
  const handleMatch = trimmed.match(/@[a-zA-Z0-9_.-]+/);
  const ucMatch = trimmed.match(/UC[a-zA-Z0-9_-]{22}/);
  const query = ucMatch?.[0] ?? handleMatch?.[0] ?? trimmed;
  return getYouTubeChannelInfo(query);
}

async function cmdProfile(supabase: SupabaseClient, userId: string) {
  const profile = await getProfile(supabase, userId);
  const { count: total } = await supabase
    .from("subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  const { count: active } = await supabase
    .from("subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("active", true);
  console.log(`Profil        : ${profile.email} (${profile.id})`);
  console.log(
    `Plan          : ${profile.subscription_status} (max_channels: ${profile.max_channels})`,
  );
  console.log(`Langue        : ${profile.preferred_language}`);
  console.log(
    `Telegram      : ${profile.telegram_connected ? "connecté" : "non connecté"}`,
  );
  console.log(`Abonnements   : ${active}/${total} actifs`);
}

async function cmdList(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("id, channel_id, channel_name, active, source_type, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) fail(error.message);
  const rows = data as SubscriptionRow[];
  if (rows.length === 0) {
    console.log("Aucun abonnement.");
    return;
  }
  for (const sub of rows) {
    const flag = sub.active ? "[actif ]" : "[pause ]";
    const source = sub.source_type ? ` (${sub.source_type})` : "";
    console.log(`${flag} ${sub.channel_name} — ${sub.channel_id}${source}`);
  }
  console.log(
    `\n${rows.length} abonnements, ${rows.filter((s) => s.active).length} actifs.`,
  );
}

async function cmdAddChannel(
  supabase: SupabaseClient,
  userId: string,
  input: string,
  opts: { paused: boolean; aha: boolean },
) {
  const info = await resolveChannel(input);
  if (!YOUTUBE_CHANNEL_ID_RE.test(info.channelId)) {
    fail(`chaîne introuvable pour "${input}" (résolu: "${info.channelId}")`);
  }

  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id, active")
    .eq("user_id", userId)
    .eq("channel_id", info.channelId)
    .maybeSingle();
  if (existing) {
    const state = (existing as { active: boolean | null }).active
      ? "actif"
      : "en pause";
    console.log(
      `= Déjà abonné: ${info.channelName} (${info.channelId}) — ${state}`,
    );
    return;
  }

  const profile = await getProfile(supabase, userId);
  const userLang = profile.preferred_language ?? "fr";

  // Même protection que la prod : pré-marquer les vidéos existantes du flux RSS
  // comme "skipped" pour que le scanner ne crée pas de livraisons sur le backlog.
  let latestVideo: { videoId: string; title: string | null } | null = null;
  try {
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${info.channelId}`;
    const rssText = await (
      await fetch(rssUrl, { signal: AbortSignal.timeout(8000) })
    ).text();
    const videos = [...rssText.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
      .map((m) => ({
        videoId: m[1].match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1] ?? null,
        title: m[1].match(/<title>([^<]+)<\/title>/)?.[1] ?? null,
      }))
      .filter(
        (v): v is { videoId: string; title: string | null } => !!v.videoId,
      );
    if (videos.length > 0) {
      await Promise.all(
        videos.map((v) =>
          supabase.from("processed_videos").upsert(
            {
              video_id: v.videoId,
              channel_id: info.channelId,
              video_title: "[pre-subscription]",
              video_url: `https://www.youtube.com/watch?v=${v.videoId}`,
              status: "skipped",
              language: userLang,
            },
            { onConflict: "video_id,language", ignoreDuplicates: true },
          ),
        ),
      );
      latestVideo = videos[0];
    }
  } catch (e) {
    console.error(`  (pré-marquage RSS échoué, non-fatal: ${String(e)})`);
  }

  const { error } = await supabase.from("subscriptions").insert({
    user_id: userId,
    channel_id: info.channelId,
    channel_name: info.channelName,
    channel_avatar_url: info.channelAvatarUrl,
    active: !opts.paused,
    paused_by_system: false,
  });
  if (error) fail(`insert abonnement: ${error.message}`);
  console.log(
    `+ Abonné: ${info.channelName} (${info.channelId})${opts.paused ? " [en pause]" : ""}`,
  );

  if (opts.aha && latestVideo) {
    const { queued } = await queueVideoForProcessing(supabase, {
      userId,
      videoId: latestVideo.videoId,
      videoTitle: latestVideo.title ?? latestVideo.videoId,
      channelId: info.channelId,
      userLang,
      priority: 100,
    });
    console.log(
      `  ${queued ? "→ vidéo en file" : "→ livraison créée (déjà traitée)"}: ${latestVideo.title}`,
    );
  }
}

async function cmdRemoveChannel(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  opts: { pause: boolean },
) {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("id, channel_id, channel_name, active, source_type, created_at")
    .eq("user_id", userId);
  if (error) fail(error.message);
  const rows = data as SubscriptionRow[];
  const q = query.toLowerCase();
  const matches = rows.filter(
    (s) => s.channel_id === query || s.channel_name.toLowerCase().includes(q),
  );
  if (matches.length === 0) fail(`aucun abonnement ne correspond à "${query}"`);
  if (matches.length > 1) {
    console.error(`"${query}" est ambigu, ${matches.length} correspondances :`);
    for (const m of matches)
      console.error(`  - ${m.channel_name} (${m.channel_id})`);
    process.exit(1);
  }
  const sub = matches[0];
  if (opts.pause) {
    const { error: updateError } = await supabase
      .from("subscriptions")
      .update({ active: false })
      .eq("id", sub.id);
    if (updateError) fail(updateError.message);
    console.log(`~ Mis en pause: ${sub.channel_name} (${sub.channel_id})`);
  } else {
    const { error: deleteError } = await supabase
      .from("subscriptions")
      .delete()
      .eq("id", sub.id);
    if (deleteError) fail(deleteError.message);
    console.log(`- Désabonné: ${sub.channel_name} (${sub.channel_id})`);
  }
}

async function cmdAddVideo(
  supabase: SupabaseClient,
  userId: string,
  input: string,
  opts: { title?: string },
) {
  const videoId = extractVideoId(input);
  if (!videoId) fail(`impossible d'extraire un ID de vidéo de "${input}"`);

  let title = opts.title ?? "";
  if (!title) {
    const oembed = await fetchVideoOembed(videoId);
    title = oembed?.title ?? videoId;
  }

  const profile = await getProfile(supabase, userId);
  const { queued } = await queueVideoForProcessing(supabase, {
    userId,
    videoId,
    videoTitle: title,
    channelId: "",
    userLang: profile.preferred_language ?? "fr",
    priority: 100,
  });
  console.log(
    `${queued ? "+ En file de traitement" : "= Déjà traitée, livraison créée"}: ${title} (${videoId})`,
  );
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      user: { type: "string" },
      title: { type: "string" },
      paused: { type: "boolean", default: false },
      aha: { type: "boolean", default: false },
      pause: { type: "boolean", default: false },
    },
  });

  const [command, arg] = positionals;
  const supabase = makeAdminClient();
  const userId = await resolveUserId(supabase, values.user);

  switch (command) {
    case "profile":
      await cmdProfile(supabase, userId);
      break;
    case "list":
      await cmdList(supabase, userId);
      break;
    case "add-channel":
      if (!arg) fail("usage: add-channel <@handle|url|UCid>");
      await cmdAddChannel(supabase, userId, arg, {
        paused: values.paused,
        aha: values.aha,
      });
      break;
    case "remove-channel":
      if (!arg) fail("usage: remove-channel <UCid|nom>");
      await cmdRemoveChannel(supabase, userId, arg, { pause: values.pause });
      break;
    case "add-video":
      if (!arg) fail("usage: add-video <url|videoId>");
      await cmdAddVideo(supabase, userId, arg, { title: values.title });
      break;
    default:
      fail(
        `commande inconnue "${command}" — commandes: profile, list, add-channel, remove-channel, add-video`,
      );
  }
}

void main();
