"use client";

import { useState } from "react";
import { Mail } from "@/lib/icons";
import { triggerTestDailyDigest } from "@app/dashboard/admin/actions";

export function DigestTriggerButton() {
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error" | "skipped"
  >("idle");
  const [result, setResult] = useState<{
    count?: number;
    reason?: string;
  } | null>(null);

  const handleTrigger = async () => {
    setStatus("loading");
    setResult(null);
    try {
      const data = await triggerTestDailyDigest();
      setResult(data);
      setStatus(data.sent ? "success" : "skipped");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <button
          onClick={() => void handleTrigger()}
          disabled={status === "loading"}
          className="nm-raised-sm flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          <Mail className="h-3.5 w-3.5" />
          {status === "loading" ? "Sending..." : "Send test digest"}
        </button>
        {status === "error" && (
          <span className="text-destructive text-xs">Error — retry</span>
        )}
      </div>
      {status === "success" && result && (
        <p className="text-xs text-emerald-400">
          Envoyé — {result.count} résumé{(result.count ?? 0) > 1 ? "s" : ""}{" "}
          inclus
        </p>
      )}
      {status === "skipped" && result && (
        <p className="text-muted-foreground text-xs">
          Ignoré : {result.reason}
        </p>
      )}
    </div>
  );
}
