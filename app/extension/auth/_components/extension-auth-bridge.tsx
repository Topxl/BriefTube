"use client";

import { CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  handoffCode: string;
  userEmail: string;
};

/**
 * Bridge between the user's brief-tube.com session and the Chrome extension.
 *
 * We render a single-use handoff code into a hidden DOM node. The extension's
 * content script (see `extension/src/content-auth/index.ts`) reads the code
 * and relays it to the background service worker, which POSTs it to
 * `/api/extension/auth/exchange` to receive the actual session tokens.
 *
 * We intentionally do NOT render the tokens themselves: any other extension
 * the user has installed with host_permissions on brief-tube.com would be
 * able to read them. The code is useless without a server round-trip, and
 * the server invalidates it after the first exchange (plus a 2-minute TTL).
 */
export function ExtensionAuthBridge({ handoffCode, userEmail }: Props) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
      {/* The extension's content script reads this node. */}
      <div
        id="brieftube-extension-handoff"
        data-handoff-code={handoffCode}
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
