"use client";

import { CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userEmail: string;
};

/**
 * Bridge between the user's brief-tube.com session and the Chrome extension.
 *
 * We render the session tokens into a hidden DOM node with stable data-*
 * attributes. The BriefTube extension injects a content script on this page
 * (see `extension/src/content-auth/index.ts`) that reads the node and relays
 * the session to the extension's background service worker, then closes the
 * tab. If the extension is not installed, the node simply sits there.
 */
export function ExtensionAuthBridge({
  accessToken,
  refreshToken,
  expiresAt,
  userEmail,
}: Props) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
      {/* The extension's content script reads this node. */}
      <div
        id="brieftube-extension-handoff"
        data-access-token={accessToken}
        data-refresh-token={refreshToken}
        data-expires-at={String(expiresAt)}
        hidden
      />

      <Card className="w-full">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <CheckCircle2 className="size-10 text-green-500" />
          <h1 className="text-xl font-semibold">
            BriefTube extension connected
          </h1>
          <p className="text-muted-foreground text-sm">
            Signed in as <span className="font-medium">{userEmail}</span>.
          </p>
          <p className="text-muted-foreground text-xs">
            You can close this tab — the extension now has your session.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
