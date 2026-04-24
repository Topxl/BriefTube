import crypto from "crypto";
import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  encryptHandoff,
  isHandoffCryptoConfigured,
} from "@/lib/extension/handoff-crypto";
import { logger } from "@/lib/logger";
import { ExtensionAuthBridge } from "./_components/extension-auth-bridge";

type PageProps = {
  searchParams: Promise<{
    ext_id?: string;
  }>;
};

const HANDOFF_TTL_SECONDS = 120;

/**
 * Extension sign-in bridge.
 *
 * Flow:
 * 1. The extension opens this page in a normal browser tab (`chrome.tabs.create`).
 * 2. If the visitor is signed in on brief-tube.com, we encrypt the Supabase
 *    session (access + refresh token) under a random one-time code, store it
 *    in `extension_auth_handoffs`, and render *only the code* in the DOM.
 * 3. The extension's auth content script reads the code, relays it to the
 *    background service worker, which POSTs it to /api/extension/auth/exchange
 *    to trade it for the actual tokens (one-time, 2-minute TTL).
 * 4. If not signed in, redirect to /login?next=/extension/auth and come back.
 *
 * Why not render the tokens directly: any other extension the user has
 * installed with host_permissions on brief-tube.com could read the hidden
 * DOM node. The handoff-code pattern means only whoever exchanges first
 * gets the tokens, and we can revoke unused codes at any time.
 */
export default async function ExtensionAuthPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const extId = params.ext_id ?? "";

  if (!extId) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold">Extension sign-in</h1>
        <p className="text-muted-foreground">
          This page must be opened by the BriefTube Chrome extension.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    const next = `/extension/auth?ext_id=${encodeURIComponent(extId)}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  if (!isHandoffCryptoConfigured()) {
    logger.error(
      "[extension/auth] EXTENSION_HANDOFF_KEY (or YOUTUBE_TOKEN_KEY fallback) is not configured — cannot hand off session to extension",
    );
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold">
          Extension sign-in unavailable
        </h1>
        <p className="text-muted-foreground">
          Server misconfiguration — please try again later or contact support.
        </p>
      </div>
    );
  }

  const payload = JSON.stringify({
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? 0,
  });
  const encrypted = encryptHandoff(payload);
  if (!encrypted) {
    logger.error("[extension/auth] encryption failed");
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold">
          Extension sign-in unavailable
        </h1>
        <p className="text-muted-foreground">Please try again later.</p>
      </div>
    );
  }

  const code = crypto.randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + HANDOFF_TTL_SECONDS * 1000);

  const admin = createAdminClient();
  const { error: insertError } = await admin
    .from("extension_auth_handoffs")
    .insert({
      code,
      user_id: session.user.id,
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      expires_at: expiresAt.toISOString(),
    });
  if (insertError) {
    logger.error("[extension/auth] failed to persist handoff", insertError);
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold">
          Extension sign-in unavailable
        </h1>
        <p className="text-muted-foreground">Please try again later.</p>
      </div>
    );
  }

  return (
    <ExtensionAuthBridge
      handoffCode={code}
      userEmail={session.user.email ?? ""}
    />
  );
}
