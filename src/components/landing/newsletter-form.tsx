"use client";

import { useState } from "react";
import { CheckCircle } from "@/lib/icons";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error();
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-400">
        <CheckCircle className="h-4 w-4 shrink-0" />
        <span>You&apos;re subscribed!</span>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="flex gap-2"
      suppressHydrationWarning
    >
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        required
        className="text-foreground placeholder:text-muted-foreground/50 w-44 rounded-lg border border-white/[0.08] bg-white/[0.06] px-3 py-1.5 text-sm transition-colors outline-none focus:border-white/[0.16]"
        suppressHydrationWarning
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-50"
        suppressHydrationWarning
      >
        {status === "loading" ? "..." : "Subscribe"}
      </button>
      {status === "error" && (
        <p className="text-destructive mt-1 text-xs">Try again.</p>
      )}
    </form>
  );
}
