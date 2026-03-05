"use client";

import { useState } from "react";
import { Zap } from "@/lib/icons";
import { extendAllTrialsTo30Days } from "@app/dashboard/admin/actions";

export function ExtendTrialsButton() {
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [updated, setUpdated] = useState(0);

  const handleTrigger = async () => {
    setStatus("loading");
    try {
      const data = await extendAllTrialsTo30Days();
      setUpdated(data.updated);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => void handleTrigger()}
        disabled={status === "loading" || status === "success"}
        className="nm-raised-sm flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
      >
        <Zap className="h-3.5 w-3.5" />
        {status === "loading" ? "Updating..." : "Extend all trials to 30 days"}
      </button>
      {status === "success" && (
        <span className="text-xs text-emerald-400">
          {updated} profiles updated
        </span>
      )}
      {status === "error" && (
        <span className="text-destructive text-xs">Error — try again</span>
      )}
    </div>
  );
}
