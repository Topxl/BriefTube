"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

/**
 * Landing-page URL input. Users paste a YouTube URL and click go.
 * Stores the URL in a cookie so the dashboard can auto-process it after
 * the sign-up/login flow completes. Redirects to /login.
 */
export function HeroUrlInput() {
  const [url, setUrl] = useState("");
  const router = useRouter();

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = url.trim();
      if (trimmed) {
        // Store for the dashboard to pick up after login
        document.cookie = `bt_pending_url=${encodeURIComponent(trimmed)}; path=/; max-age=600; SameSite=Lax`;
      }
      router.push("/login");
    },
    [url, router],
  );

  return (
    <form
      onSubmit={handleSubmit}
      suppressHydrationWarning
      className="mx-auto flex w-full max-w-lg items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] p-1.5 backdrop-blur-sm transition-colors focus-within:border-white/[0.15] focus-within:bg-white/[0.06]"
    >
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Paste a YouTube URL or @channel..."
        suppressHydrationWarning
        className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none"
      />
      <button
        type="submit"
        suppressHydrationWarning
        className="shrink-0 rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(239,68,68,0.3)] transition-all hover:bg-red-500 hover:shadow-[0_0_30px_rgba(239,68,68,0.4)]"
      >
        Summarize
      </button>
    </form>
  );
}
