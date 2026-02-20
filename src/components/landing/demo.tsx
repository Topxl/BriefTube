"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "@/lib/icons";
import { t } from "@/locales";

const tl = t.landing.demo;

type DemoResult = {
  videoId: string;
  title: string;
  channel: string;
  summary: string;
};

export function Demo() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DemoResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const res = await fetch("/api/demo/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.trim() }),
    });

    const data = (await res.json()) as DemoResult & { error?: string };

    if (!res.ok || data.error) {
      setError(data.error ?? tl.error);
    } else {
      setResult(data);
    }
    setLoading(false);
  };

  return (
    <section id="demo" className="py-20 md:py-28">
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
            onChange={(e) => setUrl(e.target.value)}
            placeholder={tl.placeholder}
            className="flex-1"
            disabled={loading}
            suppressHydrationWarning
          />
          <Button
            type="submit"
            disabled={loading || !url.trim()}
            className="shrink-0 bg-red-600 hover:bg-red-500"
            suppressHydrationWarning
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : tl.submit}
          </Button>
        </form>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        {result && (
          <div className="mt-8 rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 text-left">
            <div className="mb-4 flex items-start gap-3">
              <img
                src={`https://img.youtube.com/vi/${result.videoId}/default.jpg`}
                alt={result.title}
                className="h-16 w-28 shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs font-medium">
                  {result.channel}
                </p>
                <p className="mt-0.5 text-sm leading-snug font-semibold">
                  {result.title}
                </p>
              </div>
            </div>

            <p className="text-muted-foreground text-sm leading-relaxed">
              {result.summary}
            </p>

            <div className="mt-6 rounded-lg border border-red-500/20 bg-red-500/[0.05] p-4">
              <p className="mb-3 text-sm font-medium">{tl.upsellText}</p>
              <Button
                size="sm"
                className="w-full bg-red-600 hover:bg-red-500 sm:w-auto"
                asChild
              >
                <Link href="/login">{tl.upsellCta}</Link>
              </Button>
            </div>
          </div>
        )}

        {!result && !loading && (
          <p className="text-muted-foreground mt-4 text-xs">{tl.hint}</p>
        )}
      </div>
    </section>
  );
}
