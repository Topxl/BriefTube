"use client";

import { useState } from "react";
import { Mail } from "@/lib/icons";
import { triggerSurveyEmails } from "@app/dashboard/admin/actions";

export function SurveyEmailsButton() {
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [result, setResult] = useState<{
    sent: number;
    skipped: number;
    errors: number;
  } | null>(null);

  const handleTrigger = async () => {
    setStatus("loading");
    setResult(null);
    try {
      const data = await triggerSurveyEmails();
      setResult(data);
      setStatus("success");
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
          {status === "loading" ? "Sending..." : "Send survey"}
        </button>
        {status === "error" && (
          <span className="text-destructive text-xs">Error — try again</span>
        )}
      </div>
      {status === "success" && result && (
        <div className="text-muted-foreground flex gap-4 text-xs">
          <span>
            <span className="text-emerald-400">{result.sent} sent</span>
            {result.skipped > 0 && `, ${result.skipped} skipped`}
            {result.errors > 0 && (
              <span className="text-red-400">, {result.errors} errors</span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
