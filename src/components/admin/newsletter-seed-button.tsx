"use client";

import { useState } from "react";
import { Mail } from "@/lib/icons";

type SeedResult = {
  total: number;
  added: number;
  skipped: number;
};

export function NewsletterSeedButton() {
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [result, setResult] = useState<SeedResult | null>(null);

  const handleSeed = async () => {
    setStatus("loading");
    setResult(null);
    try {
      const res = await fetch("/api/admin/seed-newsletter", {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as SeedResult;
      setResult(data);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => void handleSeed()}
        disabled={status === "loading"}
        className="nm-raised-sm flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
      >
        <Mail className="h-3.5 w-3.5" />
        {status === "loading" ? "Syncing..." : "Sync to Resend"}
      </button>
      {status === "success" && result && (
        <span className="text-xs text-emerald-400">
          {result.added} added, {result.skipped} skipped / {result.total} total
        </span>
      )}
      {status === "error" && (
        <span className="text-destructive text-xs">Error — try again</span>
      )}
    </div>
  );
}
