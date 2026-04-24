import { BRIEFTUBE_CONFIG } from "./config";
import { clearSession, getDeviceId, getSession, setSession } from "./storage";
import type {
  MeResponse,
  StatusResponse,
  StoredSession,
  SummarizeRequest,
  SummarizeResponse,
} from "./types";

/**
 * Refresh the Supabase access token using the stored refresh token.
 * Supabase auth endpoint accepts the anon key as Authorization for refresh.
 */
async function refreshSession(
  _session: StoredSession,
): Promise<StoredSession | null> {
  // The extension intentionally doesn't embed the Supabase URL/anon key.
  // Instead we hit our Next.js proxy that will swap refresh -> access.
  // For now, ask the user to re-login when the token is stale.
  return null;
}

async function withAuth(
  init: RequestInit = {},
): Promise<RequestInit & { headers: Record<string, string> }> {
  const deviceId = await getDeviceId();
  const session = await getSession();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Device-Id": deviceId,
    "X-Extension-Version": BRIEFTUBE_CONFIG.extensionVersion,
    ...((init.headers as Record<string, string> | undefined) ?? {}),
  };
  if (session) {
    const now = Math.floor(Date.now() / 1000);
    // Refresh 60 s before expiry if possible; otherwise prompt sign-in
    if (session.expiresAt && session.expiresAt - now < 60) {
      const refreshed = await refreshSession(session);
      if (refreshed) {
        await setSession(refreshed);
        headers.Authorization = `Bearer ${refreshed.accessToken}`;
      } else {
        await clearSession();
      }
    } else {
      headers.Authorization = `Bearer ${session.accessToken}`;
    }
  }
  return { ...init, headers };
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const opts = await withAuth(init);
  const res = await fetch(`${BRIEFTUBE_CONFIG.apiBase}${path}`, opts);
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // ignore
    }
    const err = new Error(`API ${path} failed: ${res.status}`) as Error & {
      status: number;
      body?: unknown;
    };
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return (await res.json()) as T;
}

export async function fetchMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>("/api/extension/me", { method: "GET" });
}

export async function updatePreferredLanguage(
  preferredLanguage: string,
): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>("/api/extension/me", {
    method: "PATCH",
    body: JSON.stringify({ preferredLanguage }),
  });
}

export async function summarize(
  request: SummarizeRequest,
): Promise<SummarizeResponse> {
  const deviceId = await getDeviceId();
  return apiFetch<SummarizeResponse>("/api/extension/summarize", {
    method: "POST",
    body: JSON.stringify({ ...request, deviceId }),
  });
}

export async function enqueue(payload: {
  videoId: string;
  videoTitle?: string;
  channelId?: string;
  targetLanguage?: string;
}): Promise<{
  ok: boolean;
  queued: boolean;
  videoId: string;
  language: string;
}> {
  return apiFetch("/api/extension/enqueue", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchStatus(
  videoId: string,
  language: string,
): Promise<StatusResponse> {
  return apiFetch<StatusResponse>(
    `/api/extension/status/${encodeURIComponent(videoId)}?lang=${encodeURIComponent(language)}`,
    { method: "GET" },
  );
}

export async function subscribeChannel(payload: {
  channelId: string;
  channelName: string;
  channelAvatarUrl?: string;
}): Promise<{ ok: boolean; subscription: string; alreadySubscribed: boolean }> {
  return apiFetch("/api/extension/subscribe-channel", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function exchangeHandoff(
  code: string,
): Promise<StoredSession> {
  return apiFetch<StoredSession>("/api/extension/auth/exchange", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}
