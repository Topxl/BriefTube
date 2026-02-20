"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Youtube, X, Plus, Loader2 } from "@/lib/icons";
import { toast } from "sonner";

function isYouTubeInput(val: string): boolean {
  const v = val.trim();
  return (
    v.includes("youtube.com") ||
    v.includes("youtu.be") ||
    v.startsWith("@") ||
    /^UC[\w-]{10,}$/.test(v)
  );
}

export function ChannelSearchBar() {
  const [q, setQ] = useQueryState("q", { defaultValue: "", shallow: true });
  const [adding, setAdding] = useState(false);
  const router = useRouter();

  const trimmed = q.trim();
  const isAddMode = trimmed.length > 0 && isYouTubeInput(trimmed);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmed || !isAddMode) return;
    setAdding(true);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = (await res.json()) as { active?: boolean; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Failed to add channel");
        return;
      }
      toast.success(
        data.active
          ? "Channel added and active"
          : "Channel added (paused — active limit reached)",
      );
      await setQ(null);
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setAdding(false);
    }
  };

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="flex w-full gap-2"
      data-form-type="other"
      suppressHydrationWarning
    >
      <div className="relative flex-1">
        {isAddMode ? (
          <Youtube className="text-muted-foreground absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
        ) : (
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
        )}
        <Input
          type="text"
          value={q}
          onChange={(e) => void setQ(e.target.value || null)}
          placeholder="Search channels or paste a YouTube URL…"
          className="placeholder:text-muted-foreground/40 h-9 border-white/[0.16] bg-white/[0.06] pr-8 pl-8 text-sm hover:border-white/[0.24] hover:bg-white/[0.08] focus-visible:border-white/[0.28]"
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          data-form-type="other"
        />
        {q && (
          <button
            type="button"
            onClick={() => void setQ(null)}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {isAddMode && (
        <Button
          type="submit"
          disabled={adding}
          size="sm"
          className="h-9 shrink-0 bg-red-600 shadow-[0_0_12px_rgba(239,68,68,0.15)] hover:bg-red-500"
        >
          {adding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </Button>
      )}
    </form>
  );
}
