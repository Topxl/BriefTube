"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t } from "@/locales";

const tl = t.landing.demo;

function extractVideoId(url: string): string | null {
  const m = url.match(
    /(?:watch\?(?:[^&]*&)*v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );
  return m ? m[1] : null;
}

export function Demo() {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    const videoId = extractVideoId(trimmed);
    if (!videoId) {
      setError("Please enter a valid YouTube video URL.");
      return;
    }

    localStorage.setItem("pendingVideo", JSON.stringify({ videoId }));
    window.location.href = "/login";
  };

  return (
    <section id="demo" className="py-14 md:py-20">
      <div className="mx-auto max-w-2xl px-6 text-center">
        <p className="text-muted-foreground mb-2 text-sm font-medium tracking-wider uppercase">
          {tl.label}
        </p>
        <h2 className="font-display mb-4 text-3xl font-bold tracking-tight md:text-4xl">
          {tl.heading}
        </h2>
        <p className="text-muted-foreground mb-8 text-base">{tl.subtitle}</p>

        <form
          onSubmit={handleSubmit}
          className="flex gap-2"
          suppressHydrationWarning
        >
          <Input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(null);
            }}
            placeholder={tl.placeholder}
            className="flex-1"
            suppressHydrationWarning
          />
          <Button
            type="submit"
            disabled={!url.trim()}
            className="shrink-0 bg-red-600 hover:bg-red-500"
            suppressHydrationWarning
          >
            {tl.submit}
          </Button>
        </form>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        {!error && (
          <p className="text-muted-foreground mt-4 text-xs">{tl.hint}</p>
        )}
      </div>
    </section>
  );
}
