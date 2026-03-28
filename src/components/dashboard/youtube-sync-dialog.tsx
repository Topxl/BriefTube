"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Pause, Check, Loader2, X, RefreshCw } from "@/lib/icons";
import { Button } from "@/components/ui/button";

type AddedChannel = {
  channelId: string;
  channelName: string;
  avatarUrl: string | null;
};

type RemovedChannel = {
  channelId: string;
  channelName: string;
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
type RemoveAction = "deactivate" | "delete" | "keep";

export function YouTubeSyncDialog() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [diff, setDiff] = useState<SyncDiff | null>(null);
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState(false);

  // Per-channel action choices
  const [addActions, setAddActions] = useState<Record<string, AddAction>>({});
  const [removeActions, setRemoveActions] = useState<
    Record<string, RemoveAction>
  >({});

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
          setDiff(parsed);
          setOpen(true);
          // Default actions: add all as paused, deactivate removed
          const addDefaults: Record<string, AddAction> = {};
          for (const ch of parsed.added) {
            addDefaults[ch.channelId] = "add_paused";
          }
          setAddActions(addDefaults);

          const removeDefaults: Record<string, RemoveAction> = {};
          for (const ch of parsed.removed) {
            removeDefaults[ch.channelId] = "deactivate";
          }
          setRemoveActions(removeDefaults);
        } catch {
          toast.error("Failed to load sync data");
        }
      })();
    }
  }, [searchParams]);

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
        removed: diff.removed.map((ch) => ({
          channelId: ch.channelId,
          action: removeActions[ch.channelId] ?? "keep",
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

  const setAllRemoveActions = (action: RemoveAction) => {
    if (!diff) return;
    const next: Record<string, RemoveAction> = {};
    for (const ch of diff.removed) next[ch.channelId] = action;
    setRemoveActions(next);
  };

  if (!open || !diff) return null;

  const hasChanges = diff.added.length > 0 || diff.removed.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="nm-raised mx-4 flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl">
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
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                      <Plus className="h-3 w-3" />
                      New channels ({diff.added.length})
                    </h3>
                    <div className="flex gap-1">
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
                        <select
                          value={addActions[ch.channelId] ?? "add_paused"}
                          onChange={(e) =>
                            setAddActions((prev) => ({
                              ...prev,
                              [ch.channelId]: e.target.value as AddAction,
                            }))
                          }
                          className="nm-raised-sm rounded-lg bg-transparent px-2 py-1 text-[11px] font-medium outline-none"
                        >
                          <option value="add_active">Add active</option>
                          <option value="add_paused">Add paused</option>
                          <option value="ignore">Ignore</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Removed channels */}
              {diff.removed.length > 0 && (
                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
                      <Trash2 className="h-3 w-3" />
                      No longer on YouTube ({diff.removed.length})
                    </h3>
                    <div className="flex gap-1">
                      <ActionChip
                        label="Deactivate all"
                        active={diff.removed.every(
                          (c) => removeActions[c.channelId] === "deactivate",
                        )}
                        onClick={() => setAllRemoveActions("deactivate")}
                      />
                      <ActionChip
                        label="Delete all"
                        active={diff.removed.every(
                          (c) => removeActions[c.channelId] === "delete",
                        )}
                        onClick={() => setAllRemoveActions("delete")}
                      />
                      <ActionChip
                        label="Keep all"
                        active={diff.removed.every(
                          (c) => removeActions[c.channelId] === "keep",
                        )}
                        onClick={() => setAllRemoveActions("keep")}
                      />
                    </div>
                  </div>
                  <div className="nm-inset-sm flex flex-col divide-y divide-white/[0.04] rounded-xl">
                    {diff.removed.map((ch) => (
                      <div
                        key={ch.channelId}
                        className="flex items-center gap-3 px-3 py-2"
                      >
                        <ChannelAvatar name={ch.channelName} url={null} />
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {ch.channelName}
                        </span>
                        <select
                          value={removeActions[ch.channelId] ?? "deactivate"}
                          onChange={(e) =>
                            setRemoveActions((prev) => ({
                              ...prev,
                              [ch.channelId]: e.target.value as RemoveAction,
                            }))
                          }
                          className="nm-raised-sm rounded-lg bg-transparent px-2 py-1 text-[11px] font-medium outline-none"
                        >
                          <option value="deactivate">Deactivate</option>
                          <option value="delete">Delete</option>
                          <option value="keep">Keep</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Unchanged summary */}
              {diff.unchanged.length > 0 && (
                <section>
                  <div className="mb-2 flex items-center gap-1.5">
                    <Pause className="text-muted-foreground h-3 w-3" />
                    <h3 className="text-muted-foreground text-xs font-semibold">
                      Unchanged ({diff.unchanged.length})
                    </h3>
                  </div>
                  <p className="text-muted-foreground/60 text-xs">
                    {diff.unchanged.filter((c) => c.active).length} active,{" "}
                    {diff.unchanged.filter((c) => !c.active).length} paused
                    &mdash; no changes needed.
                  </p>
                </section>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-5 py-3">
          <Button variant="ghost" size="sm" onClick={close}>
            Cancel
          </Button>
          {hasChanges && (
            <Button
              size="sm"
              disabled={applying}
              onClick={() => void handleApply()}
              className="bg-red-600 hover:bg-red-500"
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
      className={`rounded-full px-2 py-0.5 text-[9px] font-medium transition-colors ${
        active
          ? "nm-inset text-foreground"
          : "text-muted-foreground/50 hover:text-muted-foreground"
      }`}
    >
      {label}
    </button>
  );
}
