"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Plus, Check, Loader2, X, RefreshCw } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { capture } from "@/lib/posthog/client";

type AddedChannel = {
  channelId: string;
  channelName: string;
  avatarUrl: string | null;
};

type RemovedChannel = {
  channelId: string;
  channelName: string;
  avatarUrl: string | null;
};

type UnchangedChannel = {
  channelId: string;
  channelName: string;
  active: boolean;
};

type SyncDiff = {
  added: AddedChannel[];
  removed: RemovedChannel[];
  unchanged: UnchangedChannel[];
};

type AddAction = "add_active" | "add_paused" | "ignore";

export function YouTubeSyncDialog() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [diff, setDiff] = useState<SyncDiff | null>(null);
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState(false);

  // Per-channel action choices for "added" only — "removed" is always
  // auto-deactivated, no per-channel choice.
  const [addActions, setAddActions] = useState<Record<string, AddAction>>({});

  useEffect(() => {
    if (searchParams.get("youtube_sync") === "ready") {
      void (async () => {
        try {
          const res = await fetch("/api/youtube/sync");
          if (!res.ok) {
            toast.error("Failed to load sync data");
            return;
          }
          const parsed = (await res.json()) as SyncDiff;
          // Cleanup the URL param either way.
          const url = new URL(window.location.href);
          url.searchParams.delete("youtube_sync");
          router.replace(url.pathname + url.search);

          // No new channels to decide on → apply silently (auto-deactivate
          // anything no longer on YouTube) and just toast the result.
          if (parsed.added.length === 0) {
            const apply = await fetch("/api/youtube/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                added: [],
                removed: parsed.removed.map((ch) => ({
                  channelId: ch.channelId,
                  action: "deactivate" as const,
                })),
              }),
            });
            if (apply.ok) {
              const r = (await apply.json()) as { deactivated: number };
              if (r.deactivated > 0) {
                toast.success(`${r.deactivated} channel(s) deactivated`);
              } else {
                toast.success("Already in sync");
              }
              router.refresh();
            } else {
              toast.error("Sync failed");
            }
            return;
          }

          // New channels exist — open the modal so the user can pick.
          setDiff(parsed);
          setOpen(true);
          // Default action: add all as paused.
          const addDefaults: Record<string, AddAction> = {};
          for (const ch of parsed.added) {
            addDefaults[ch.channelId] = "add_paused";
          }
          setAddActions(addDefaults);
        } catch {
          toast.error("Failed to load sync data");
        }
      })();
    }
  }, [searchParams, router]);

  const close = useCallback(() => {
    setOpen(false);
    // Clean URL
    const url = new URL(window.location.href);
    url.searchParams.delete("youtube_sync");
    router.replace(url.pathname + url.search);
  }, [router]);

  const handleApply = async () => {
    if (!diff) return;
    setApplying(true);
    try {
      const payload = {
        added: diff.added.map((ch) => ({
          channelId: ch.channelId,
          channelName: ch.channelName,
          avatarUrl: ch.avatarUrl,
          action: addActions[ch.channelId] ?? "ignore",
        })),
        // Removed channels are always auto-deactivated.
        removed: diff.removed.map((ch) => ({
          channelId: ch.channelId,
          action: "deactivate" as const,
        })),
      };

      const res = await fetch("/api/youtube/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? "Sync failed");
        return;
      }

      const result = (await res.json()) as {
        inserted: number;
        deactivated: number;
        deleted: number;
      };

      const parts: string[] = [];
      if (result.inserted > 0) parts.push(`${result.inserted} added`);
      if (result.deactivated > 0)
        parts.push(`${result.deactivated} deactivated`);
      if (result.deleted > 0) parts.push(`${result.deleted} removed`);

      toast.success(parts.length > 0 ? parts.join(", ") : "No changes applied");
      capture("youtube_synced", {
        added_count: result.inserted,
        removed_count: result.deleted,
        unchanged_count: result.deactivated,
      });
      close();
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setApplying(false);
    }
  };

  // Bulk action helpers
  const setAllAddActions = (action: AddAction) => {
    if (!diff) return;
    const next: Record<string, AddAction> = {};
    for (const ch of diff.added) next[ch.channelId] = action;
    setAddActions(next);
  };

  if (!open || !diff) return null;

  const hasChanges = diff.added.length > 0 || diff.removed.length > 0;

  return (
    <div className="pointer-events-auto fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="nm-raised mx-2 flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-white/[0.08] bg-[oklch(0.22_0_0)] shadow-[0_24px_80px_rgba(0,0,0,0.6)] sm:mx-4 sm:max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-red-400" />
            <h2 className="text-sm font-semibold">YouTube Sync</h2>
          </div>
          <button
            onClick={close}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!hasChanges ? (
            <div className="py-8 text-center">
              <Check className="mx-auto mb-2 h-8 w-8 text-emerald-400" />
              <p className="text-sm font-medium">Everything is in sync</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Your BriefTube channels match your YouTube subscriptions.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {/* New channels */}
              {diff.added.length > 0 && (
                <section>
                  <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="flex items-center gap-1.5 text-xs font-semibold">
                        <Plus className="text-muted-foreground h-3 w-3 shrink-0" />
                        New on YouTube ({diff.added.length})
                      </h3>
                      <p className="text-muted-foreground/60 mt-0.5 text-[11px] leading-snug">
                        Pick how to add them.
                      </p>
                    </div>
                    <div className="-mx-1 flex gap-1 overflow-x-auto px-1 sm:mx-0 sm:flex-wrap sm:justify-end sm:overflow-visible sm:px-0">
                      <ActionChip
                        label="All active"
                        active={diff.added.every(
                          (c) => addActions[c.channelId] === "add_active",
                        )}
                        onClick={() => setAllAddActions("add_active")}
                      />
                      <ActionChip
                        label="All paused"
                        active={diff.added.every(
                          (c) => addActions[c.channelId] === "add_paused",
                        )}
                        onClick={() => setAllAddActions("add_paused")}
                      />
                      <ActionChip
                        label="Ignore all"
                        active={diff.added.every(
                          (c) => addActions[c.channelId] === "ignore",
                        )}
                        onClick={() => setAllAddActions("ignore")}
                      />
                    </div>
                  </div>
                  <div className="nm-inset-sm flex flex-col divide-y divide-white/[0.04] rounded-xl">
                    {diff.added.map((ch) => (
                      <div
                        key={ch.channelId}
                        className="flex items-center gap-3 px-3 py-2"
                      >
                        <ChannelAvatar
                          name={ch.channelName}
                          url={ch.avatarUrl}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {ch.channelName}
                        </span>
                        <Select
                          value={addActions[ch.channelId] ?? "add_paused"}
                          onValueChange={(value) =>
                            setAddActions((prev) => ({
                              ...prev,
                              [ch.channelId]: value as AddAction,
                            }))
                          }
                        >
                          <SelectTrigger
                            size="sm"
                            className="nm-raised-sm h-7 min-w-[96px] rounded-lg border-0 bg-transparent px-2 py-1 text-[11px] font-medium shadow-none"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent align="end" className="min-w-[140px]">
                            <SelectItem value="add_active">
                              Add active
                            </SelectItem>
                            <SelectItem value="add_paused">
                              Add paused
                            </SelectItem>
                            <SelectItem value="ignore">Ignore</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Removed and unchanged channels are not shown — removed are
                  auto-deactivated server-side, unchanged are noise. */}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse gap-2 border-t border-white/[0.06] px-5 py-3 sm:flex-row sm:items-center sm:justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={close}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          {hasChanges && (
            <Button
              size="sm"
              disabled={applying}
              onClick={() => void handleApply()}
              className="w-full bg-red-600 hover:bg-red-500 sm:w-auto"
            >
              {applying && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              Apply changes
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ChannelAvatar({ name, url }: { name: string; url: string | null }) {
  const [error, setError] = useState(false);
  if (url && !error) {
    return (
      <img
        src={url}
        alt={name}
        className="h-7 w-7 shrink-0 rounded-full"
        // YouTube avatar CDN (yt3.ggpht.com / yt3.googleusercontent.com) returns
        // 403 when the Referer is not whitelisted — `no-referrer` makes them load.
        referrerPolicy="no-referrer"
        onError={() => setError(true)}
      />
    );
  }
  return (
    <div className="bg-muted flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function ActionChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium whitespace-nowrap transition-colors ${
        active
          ? "nm-inset text-foreground"
          : "text-muted-foreground/60 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
