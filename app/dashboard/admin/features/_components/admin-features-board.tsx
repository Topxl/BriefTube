"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUp, Bell, Check, Loader2, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type FeatureStatus =
  | "new"
  | "under_review"
  | "planned"
  | "in_progress"
  | "shipped"
  | "rejected";

type AdminFeature = {
  id: string;
  user_id: string | null;
  title: string;
  description: string;
  status: FeatureStatus;
  category: string;
  priority: number;
  votes_count: number;
  admin_notes: string | null;
  source: string;
  needs_admin_review: boolean;
  shipped_notification_sent: boolean;
  created_at: string;
  updated_at: string;
  profiles: { email: string } | null;
};

const PENDING_KEY = "__pending_review__";

const COLUMNS: { key: string; label: string; color: string }[] = [
  { key: PENDING_KEY, label: "Pending review", color: "border-amber-500/40" },
  { key: "new", label: "New", color: "border-slate-500/30" },
  {
    key: "under_review",
    label: "Under review",
    color: "border-purple-500/30",
  },
  { key: "planned", label: "Planned", color: "border-blue-500/30" },
  { key: "in_progress", label: "In progress", color: "border-amber-500/30" },
  { key: "shipped", label: "Shipped", color: "border-emerald-500/30" },
  { key: "rejected", label: "Rejected", color: "border-red-500/30" },
];

export function AdminFeaturesBoard({
  initialFeatures,
}: {
  initialFeatures: AdminFeature[];
}) {
  const [features, setFeatures] = useState(initialFeatures);
  const [editing, setEditing] = useState<AdminFeature | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, AdminFeature[]>();
    for (const col of COLUMNS) map.set(col.key, []);
    for (const f of features) {
      if (f.needs_admin_review) {
        map.get(PENDING_KEY)?.push(f);
      } else {
        map.get(f.status)?.push(f);
      }
    }
    return map;
  }, [features]);

  const updateFeature = async (
    id: string,
    patch: Partial<AdminFeature>,
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/admin/features/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("update failed");
      setFeatures((prev) =>
        prev.map((f) => (f.id === id ? { ...f, ...patch } : f)),
      );
      return true;
    } catch {
      toast.error("Update failed");
      return false;
    }
  };

  const notifyShipped = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/features/${id}/notify-shipped`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("notify failed");
      const data = (await res.json()) as { notified: number };
      toast.success(`${data.notified} user(s) notified`);
      setFeatures((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, shipped_notification_sent: true } : f,
        ),
      );
    } catch {
      toast.error("Couldn't send the emails");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            className={cn(
              "border-border/60 bg-card flex flex-col gap-3 rounded-lg border p-3",
              col.key === PENDING_KEY && "ring-1 ring-amber-500/30",
            )}
          >
            <div className="flex items-center justify-between">
              <h3
                className={cn(
                  "text-foreground border-l-2 pl-2 text-sm font-semibold",
                  col.color,
                )}
              >
                {col.label}
              </h3>
              <span className="text-muted-foreground text-xs">
                {grouped.get(col.key)?.length ?? 0}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {(grouped.get(col.key) ?? []).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setEditing(f)}
                  className={cn(
                    "border-border/60 bg-background hover:border-border flex flex-col gap-1 rounded-md border p-2 text-left transition",
                    f.needs_admin_review &&
                      "border-amber-500/40 bg-amber-500/5",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-foreground text-sm font-medium">
                      {f.title}
                    </span>
                    <div className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
                      <ArrowUp className="size-3" />
                      {f.votes_count}
                    </div>
                  </div>
                  <p className="text-muted-foreground line-clamp-2 text-xs">
                    {f.description}
                  </p>
                  <div className="flex flex-wrap items-center gap-1">
                    <Badge variant="outline" className="text-xs">
                      {f.category}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      P{f.priority}
                    </Badge>
                    {f.source === "chat_detected" && (
                      <Badge
                        variant="outline"
                        className="border-blue-500/30 bg-blue-500/10 text-xs text-blue-500"
                      >
                        from chat
                      </Badge>
                    )}
                  </div>
                </button>
              ))}
              {(grouped.get(col.key)?.length ?? 0) === 0 && (
                <p className="text-muted-foreground py-2 text-center text-xs italic">
                  empty
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <FeatureEditDialog
        feature={editing}
        onClose={() => setEditing(null)}
        onUpdate={updateFeature}
        onNotifyShipped={notifyShipped}
      />
    </div>
  );
}

function FeatureEditDialog({
  feature,
  onClose,
  onUpdate,
  onNotifyShipped,
}: {
  feature: AdminFeature | null;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<AdminFeature>) => Promise<boolean>;
  onNotifyShipped: (id: string) => Promise<void>;
}) {
  const [status, setStatus] = useState<FeatureStatus>(feature?.status ?? "new");
  const [priority, setPriority] = useState(feature?.priority ?? 3);
  const [notes, setNotes] = useState(feature?.admin_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    if (feature) {
      setStatus(feature.status);
      setPriority(feature.priority);
      setNotes(feature.admin_notes ?? "");
    }
  }, [feature]);

  if (!feature) return null;

  const save = async () => {
    setSaving(true);
    const ok = await onUpdate(feature.id, {
      status,
      priority,
      admin_notes: notes || null,
    });
    setSaving(false);
    if (ok) {
      toast.success("Feature updated");
      onClose();
    }
  };

  const approve = async () => {
    setReviewing(true);
    const ok = await onUpdate(feature.id, { needs_admin_review: false });
    setReviewing(false);
    if (ok) {
      toast.success("Approved, now visible to all users");
      onClose();
    }
  };

  const reject = async () => {
    setReviewing(true);
    const ok = await onUpdate(feature.id, {
      status: "rejected",
      needs_admin_review: false,
    });
    setReviewing(false);
    if (ok) {
      toast.success("Rejected");
      onClose();
    }
  };

  const notify = async () => {
    setNotifying(true);
    await onNotifyShipped(feature.id);
    setNotifying(false);
  };

  return (
    <Dialog open={Boolean(feature)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{feature.title}</DialogTitle>
          <DialogDescription>
            Submitted by {feature.profiles?.email ?? "(unknown)"} •{" "}
            {feature.votes_count} vote(s) • {feature.category}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-foreground mb-1 block text-xs font-medium">
              Description
            </label>
            <p className="border-border/60 bg-muted/40 text-foreground rounded-md border p-3 text-sm whitespace-pre-wrap">
              {feature.description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-foreground mb-1 block text-xs font-medium">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as FeatureStatus)}
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              >
                {COLUMNS.filter((c) => c.key !== PENDING_KEY).map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-foreground mb-1 block text-xs font-medium">
                Priority (1-5)
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value, 10))}
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              >
                {[1, 2, 3, 4, 5].map((p) => (
                  <option key={p} value={p}>
                    P{p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-foreground mb-1 block text-xs font-medium">
              Admin notes (private)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Internal notes for this feature…"
              className="border-input bg-background w-full resize-none rounded-md border px-3 py-2 text-sm"
            />
          </div>

          {feature.needs_admin_review && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="text-foreground mb-2 text-xs font-medium">
                Pending review (auto-detected by Léa from chat)
              </p>
              <p className="text-muted-foreground mb-3 text-xs">
                Currently only the proposer and you can see this. Approve to
                make it visible to everyone, or reject to discard.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => void approve()}
                  disabled={reviewing}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {reviewing && (
                    <Loader2 className="mr-1 size-3 animate-spin" />
                  )}
                  <Check className="mr-1 size-4" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void reject()}
                  disabled={reviewing}
                >
                  <XIcon className="mr-1 size-4" />
                  Reject
                </Button>
              </div>
            </div>
          )}

          {status === "shipped" && (
            <div className="border-border/60 rounded-md border bg-emerald-500/5 p-3">
              <p className="text-foreground mb-2 text-xs font-medium">
                Notify voters that this feature is live
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void notify()}
                disabled={notifying || feature.shipped_notification_sent}
              >
                {notifying && <Loader2 className="mr-1 size-3 animate-spin" />}
                <Bell className="mr-1 size-4" />
                {feature.shipped_notification_sent
                  ? "Already notified"
                  : "Send emails"}
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving && <Loader2 className="mr-1 size-3 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
