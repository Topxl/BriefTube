"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2Icon, XCircleIcon, CopyIcon } from "@/lib/icons";
import { toast } from "sonner";
import type { Profile } from "@/lib/supabase/client";

export function TelegramConnect({ profile }: { profile: Profile | null }) {
  const copyToken = () => {
    if (profile?.telegram_connect_token) {
      void navigator.clipboard.writeText(profile.telegram_connect_token);
      toast.success("Token copied to clipboard!");
    }
  };

  const isConnected = profile?.telegram_connected;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Telegram Connection</CardTitle>
            <CardDescription>
              Receive audio summaries directly in Telegram
            </CardDescription>
          </div>
          {isConnected ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle2Icon className="h-3 w-3" />
              Connected
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <XCircleIcon className="h-3 w-3" />
              Not Connected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConnected ? (
          <>
            <p className="text-muted-foreground text-sm">
              To connect your Telegram account:
            </p>
            <ol className="list-inside list-decimal space-y-2 text-sm">
              <li>
                Open Telegram and search for{" "}
                <code className="bg-muted rounded px-1">@BriefTubeBot</code>
              </li>
              <li>Start a chat with the bot</li>
              <li>Send this connection token:</li>
            </ol>

            {profile?.telegram_connect_token && (
              <div className="bg-muted flex items-center gap-2 rounded-lg p-3">
                <code className="flex-1 font-mono text-sm">
                  {profile.telegram_connect_token}
                </code>
                <Button size="sm" variant="ghost" onClick={copyToken}>
                  <CopyIcon className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-green-600 dark:text-green-400">
              ✓ Your Telegram account is connected! You'll receive audio
              summaries automatically.
            </p>
            {profile.tts_voice && (
              <p className="text-muted-foreground text-xs">
                Voice: {profile.tts_voice}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
