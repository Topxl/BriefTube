import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ExtensionAuthBridge } from "./_components/extension-auth-bridge";

type PageProps = {
  searchParams: Promise<{
    ext_id?: string;
  }>;
};

/**
 * Extension sign-in bridge.
 *
 * Flow:
 * 1. The extension opens this page in a normal browser tab (`chrome.tabs.create`).
 * 2. If the visitor is already signed in on brief-tube.com, the page renders
 *    the session tokens into a hidden DOM node. The extension's auth content
 *    script (see extension/src/content-auth/) reads that node and relays the
 *    session to its background service worker, then closes the tab.
 * 3. If not signed in, redirect to /login?next=/extension/auth and come back.
 *
 * No chrome.identity.launchWebAuthFlow — that API is picky about URLs, blocks
 * localhost during development, and surfaces opaque errors. A plain tab works
 * everywhere (localhost, production, dev prod preview) and the content-script
 * handoff is purely internal to the extension, so it's unaffected by CSP,
 * popup blockers, or uBlock.
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

  return (
    <ExtensionAuthBridge
      accessToken={session.access_token}
      refreshToken={session.refresh_token}
      expiresAt={session.expires_at ?? 0}
      userEmail={session.user.email ?? ""}
    />
  );
}
