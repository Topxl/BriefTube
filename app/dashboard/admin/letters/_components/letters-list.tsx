"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Loader2, Mail, Clock, Check, Archive, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type LetterRow = {
  id: string;
  episode_number: number;
  week_start: string;
  week_end: string;
  status: "draft" | "scheduled" | "sent" | "cancelled" | "skipped";
  title: string | null;
  subject: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  recipient_count: number;
  created_at: string;
  updated_at: string;
};

const STATUS_LABELS: Record<LetterRow["status"], string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  sent: "Sent",
  cancelled: "Cancelled",
  skipped: "Skipped",
};

const STATUS_COLORS: Record<LetterRow["status"], string> = {
  draft: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  scheduled: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  sent: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  cancelled: "bg-red-500/15 text-red-600 border-red-500/30",
  skipped: "bg-slate-500/15 text-slate-600 border-slate-500/30",
};

const STATUS_ICONS: Record<LetterRow["status"], React.ReactNode> = {
  draft: <Clock className="size-3" />,
  scheduled: <Clock className="size-3" />,
  sent: <Check className="size-3" />,
  cancelled: <X className="size-3" />,
  skipped: <Archive className="size-3" />,
};

type Tab = "all" | "draft" | "sent";

export function LettersList({
  initialLetters,
}: {
  initialLetters: LetterRow[];
}) {
  const [letters, setLetters] = useState(initialLetters);
  const [tab, setTab] = useState<Tab>("all");
  const [generating, setGenerating] = useState(false);

  const filtered = letters.filter((l) => {
    if (tab === "all") return true;
    if (tab === "draft")
      return l.status === "draft" || l.status === "scheduled";
    return l.status === "sent";
  });

  const counts = {
    all: letters.length,
    draft: letters.filter(
      (l) => l.status === "draft" || l.status === "scheduled",
    ).length,
    sent: letters.filter((l) => l.status === "sent").length,
  };

  const generateNow = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/letters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        id?: string;
        episode_number?: number;
        was_existing?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? "Generation failed");
        return;
      }
      if (data.was_existing) {
        toast.info(
          `Episode ${data.episode_number} already exists for this week`,
        );
      } else {
        toast.success(`Episode ${data.episode_number} draft created`);
      }
      // Refresh
      const listRes = await fetch("/api/admin/letters");
      const listData = (await listRes.json()) as { letters: LetterRow[] };
      setLetters(listData.letters);
    } catch {
      toast.error("Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {[
            { key: "all" as const, label: `All (${counts.all})` },
            { key: "draft" as const, label: `Drafts (${counts.draft})` },
            { key: "sent" as const, label: `Sent (${counts.sent})` },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition",
                tab === t.key
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          onClick={() => void generateNow()}
          disabled={generating}
        >
          {generating ? (
            <Loader2 className="mr-1 size-4 animate-spin" />
          ) : (
            <Plus className="mr-1 size-4" />
          )}
          Generate now
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="border-border/60 text-muted-foreground rounded-lg border border-dashed p-12 text-center text-sm">
          No letters in this category yet.
        </div>
      ) : (
        <ul className="border-border/60 divide-border/60 divide-y overflow-hidden rounded-lg border">
          {filtered.map((letter) => (
            <li key={letter.id}>
              <Link
                href={`/dashboard/admin/letters/${letter.id}`}
                className="hover:bg-muted/40 flex items-start gap-4 px-4 py-3 transition"
              >
                <div className="text-muted-foreground flex shrink-0 flex-col items-center gap-0.5 text-xs">
                  <span className="text-foreground text-xl leading-none font-semibold">
                    {letter.episode_number}
                  </span>
                  <span>ep.</span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-foreground truncate text-sm font-medium">
                      {letter.title ?? "(no title yet)"}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn("text-xs", STATUS_COLORS[letter.status])}
                    >
                      <span className="mr-1 inline-flex">
                        {STATUS_ICONS[letter.status]}
                      </span>
                      {STATUS_LABELS[letter.status]}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                    <span>
                      Week {letter.week_start} → {letter.week_end}
                    </span>
                    {letter.sent_at && (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <Mail className="size-3" />
                          {letter.recipient_count} recipients
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
