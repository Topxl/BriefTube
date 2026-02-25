"use client";

import { useState } from "react";
import { Mail } from "@/lib/icons";
import { triggerTrialReminders } from "@app/dashboard/admin/actions";
import type { TrialRemindersResult } from "@/lib/cron/trial-reminders";

export function TrialRemindersButton() {
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [result, setResult] = useState<TrialRemindersResult | null>(null);

  const handleTrigger = async () => {
    setStatus("loading");
    setResult(null);
    try {
      const data = await triggerTrialReminders();
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
          {status === "loading" ? "Sending..." : "Run trial reminders"}
        </button>
        {status === "error" && (
          <span className="text-destructive text-xs">Error — try again</span>
        )}
      </div>
      {status === "success" && result && (
        <div className="text-muted-foreground flex gap-4 text-xs">
          <span>
            J-3: <span className="text-emerald-400">{result.j3.sent} sent</span>
            {result.j3.skipped > 0 && `, ${result.j3.skipped} skipped`}
            {result.j3.errors > 0 && (
              <span className="text-red-400">, {result.j3.errors} errors</span>
            )}
          </span>
          <span>
            J-1: <span className="text-emerald-400">{result.j1.sent} sent</span>
            {result.j1.skipped > 0 && `, ${result.j1.skipped} skipped`}
            {result.j1.errors > 0 && (
              <span className="text-red-400">, {result.j1.errors} errors</span>
            )}
          </span>
          <span>
            Expired:{" "}
            <span className="text-emerald-400">{result.expired.sent} sent</span>
            {result.expired.skipped > 0 &&
              `, ${result.expired.skipped} skipped`}
            {result.expired.errors > 0 && (
              <span className="text-red-400">
                , {result.expired.errors} errors
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
