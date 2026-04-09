"use client";

import { useState } from "react";
import { grantProTrial } from "@app/dashboard/admin/actions";

const DURATIONS = [1, 2, 3, 6, 12] as const;

export function GrantTrialForm() {
  const [email, setEmail] = useState("");
  const [months, setMonths] = useState<(typeof DURATIONS)[number]>(3);
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [result, setResult] = useState<{
    trialEndsAt?: string;
    error?: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    setResult(null);
    try {
      const res = await grantProTrial(email.trim(), months);
      if (res.ok) {
        setResult({ trialEndsAt: res.trialEndsAt });
        setStatus("success");
        setEmail("");
      } else {
        setResult({ error: res.error });
        setStatus("error");
      }
    } catch {
      setResult({ error: "Unexpected error" });
      setStatus("error");
    }
  };

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="flex flex-col gap-3"
      suppressHydrationWarning
    >
      <div className="flex gap-2" suppressHydrationWarning>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@exemple.com"
          required
          className="bg-muted/50 border-border placeholder:text-muted-foreground/50 h-8 flex-1 rounded-lg border px-3 text-xs focus:ring-1 focus:ring-white/20 focus:outline-none"
          suppressHydrationWarning
        />
        <select
          value={months}
          onChange={(e) =>
            setMonths(Number(e.target.value) as (typeof DURATIONS)[number])
          }
          className="bg-muted/50 border-border h-8 rounded-lg border px-2 text-xs focus:ring-1 focus:ring-white/20 focus:outline-none"
          suppressHydrationWarning
        >
          {DURATIONS.map((d) => (
            <option key={d} value={d}>
              {d} month{d > 1 ? "s" : ""}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={status === "loading" || !email.trim()}
          className="nm-raised-sm h-8 rounded-lg px-3 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
          suppressHydrationWarning
        >
          {status === "loading" ? "…" : "Offrir"}
        </button>
      </div>

      {status === "success" && result?.trialEndsAt && (
        <p className="text-xs text-emerald-400">
          Accès Pro accordé jusqu&apos;au {result.trialEndsAt} — email envoyé.
        </p>
      )}
      {status === "error" && result?.error && (
        <p className="text-destructive text-xs">{result.error}</p>
      )}
    </form>
  );
}
