"use client";

import { useState } from "react";
import { Mail } from "@/lib/icons";
import { triggerReferralTrialEmails } from "@app/dashboard/admin/actions";

type RunResult = { sent: number; skipped: number; errors: number };
type ReferralTrialResult = { j3: RunResult; j1: RunResult };

export function ReferralTrialEmailsButton() {
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [result, setResult] = useState<ReferralTrialResult | null>(null);

  const handleTrigger = async () => {
    setStatus("loading");
    setResult(null);
    try {
      const data = await triggerReferralTrialEmails();
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
        {status === "loading" ? "Sending..." : "Run referral trial emails"}
      </button>
      {status === "success" && result && (
        <span className="text-xs">
          <span className="text-muted-foreground">J-3:</span>{" "}
          <span className="text-emerald-400">{result.j3.sent} sent</span>
          {result.j3.skipped > 0 && (
            <span className="text-muted-foreground">
              , {result.j3.skipped} skipped
            </span>
          )}
          {result.j3.errors > 0 && (
            <span className="text-red-400">, {result.j3.errors} errors</span>
          )}
          <span className="text-muted-foreground mx-1">·</span>
          <span className="text-muted-foreground">J-1:</span>{" "}
          <span className="text-emerald-400">{result.j1.sent} sent</span>
          {result.j1.skipped > 0 && (
            <span className="text-muted-foreground">
              , {result.j1.skipped} skipped
            </span>
          )}
          {result.j1.errors > 0 && (
            <span className="text-red-400">, {result.j1.errors} errors</span>
          )}
        </span>
      )}
      {status === "error" && (
        <span className="text-destructive text-xs">Error — try again</span>
      )}
    </div>
  );
}
