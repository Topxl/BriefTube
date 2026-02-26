"use client";

import { useState } from "react";
import { Mail } from "@/lib/icons";
import { triggerActivationEmails } from "@app/dashboard/admin/actions";

type RunResult = { sent: number; skipped: number; errors: number };

export function ActivationEmailsButton() {
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [result, setResult] = useState<RunResult | null>(null);

  const handleTrigger = async () => {
    setStatus("loading");
    setResult(null);
    try {
      const data = await triggerActivationEmails();
      setResult(data);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => void handleTrigger()}
        disabled={status === "loading"}
        className="nm-raised-sm flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
      >
        <Mail className="h-3.5 w-3.5" />
        {status === "loading" ? "Sending..." : "Run activation emails"}
      </button>
      {status === "success" && result && (
        <span className="text-xs">
          <span className="text-emerald-400">{result.sent} sent</span>
          {result.skipped > 0 && (
            <span className="text-muted-foreground">
              , {result.skipped} skipped
            </span>
          )}
          {result.errors > 0 && (
            <span className="text-red-400">, {result.errors} errors</span>
          )}
        </span>
      )}
      {status === "error" && (
        <span className="text-destructive text-xs">Error — try again</span>
      )}
    </div>
  );
}
