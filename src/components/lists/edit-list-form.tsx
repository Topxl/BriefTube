"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Loader2, Plus, Trash2 } from "@/lib/icons";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { dialogManager } from "@/features/dialog-manager/dialog-manager";

const CATEGORIES = [
  "Tech",
  "Finance",
  "Science",
  "Gaming",
  "Education",
  "News",
  "Entertainment",
  "Health",
  "Sports",
  "Other",
];

type ChannelEntry = {
  id?: string; // list_channels row id (undefined for newly added)
  channel_id: string;
  channel_name: string;
  channel_avatar_url: string | null;
};

type Props = {
  listId: string;
  initialName: string;
  initialDescription: string;
  initialCategory: string;
  initialChannels: ChannelEntry[];
};

export function EditListForm({
  listId,
  initialName,
  initialDescription,
  initialCategory,
  initialChannels,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [category, setCategory] = useState(initialCategory);
  const [channels, setChannels] = useState(initialChannels);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [channelUrl, setChannelUrl] = useState("");
  const [addingChannel, setAddingChannel] = useState(false);
  const [channelError, setChannelError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);

  const addChannel = async () => {
    if (!channelUrl.trim()) return;
    setAddingChannel(true);
    setChannelError("");
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: channelUrl }),
      });
      const data = (await res.json()) as {
        channel_id: string;
        channel_name: string;
        channel_avatar_url: string | null;
        error?: string;
      };

      if (!res.ok && res.status !== 409) {
        setChannelError(data.error ?? "Failed to resolve channel");
        return;
      }

      if (channels.some((c) => c.channel_id === data.channel_id)) {
        setChannelError("Channel already in list");
        return;
      }

      setChannels((prev) => [
        ...prev,
        {
          channel_id: data.channel_id,
          channel_name: data.channel_name,
          channel_avatar_url: data.channel_avatar_url,
        },
      ]);
      setChannelUrl("");
      setChannelError("");
    } catch {
      setChannelError("Something went wrong");
    } finally {
      setAddingChannel(false);
    }
  };

  const importFromSubscriptions = async () => {
    setImporting(true);
    try {
      const res = await fetch("/api/subscriptions");
      if (!res.ok) throw new Error();
      const subs = (await res.json()) as {
        channel_id: string;
        channel_name: string;
        channel_avatar_url: string | null;
      }[];

      const existing = new Set(channels.map((c) => c.channel_id));
      const toAdd = subs
        .filter((s) => !existing.has(s.channel_id))
        .map((s) => ({
          channel_id: s.channel_id,
          channel_name: s.channel_name,
          channel_avatar_url: s.channel_avatar_url,
        }));

      if (toAdd.length === 0) {
        toast.info("All your subscriptions are already in this list");
        return;
      }

      setChannels((prev) => [...prev, ...toAdd]);
      toast.success(`${toAdd.length} channels imported`);
    } catch {
      toast.error("Failed to import subscriptions");
    } finally {
      setImporting(false);
    }
  };

  const removeChannel = (channelId: string, rowId?: string) => {
    setChannels((prev) => prev.filter((c) => c.channel_id !== channelId));
    if (rowId) setRemovedIds((prev) => [...prev, channelId]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (channels.length === 0) {
      toast.error("A list must contain at least one channel");
      return;
    }
    setSubmitting(true);
    try {
      // 1. Update list metadata
      const patchRes = await fetch(`/api/lists/${listId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          category: category || null,
        }),
      });
      if (!patchRes.ok) {
        const d = (await patchRes.json()) as { error?: string };
        toast.error(d.error ?? "Failed to update list");
        return;
      }

      // 2. Remove channels that were deleted
      await Promise.all(
        removedIds.map(async (cid) =>
          fetch(`/api/lists/${listId}/channels/${cid}`, { method: "DELETE" }),
        ),
      );

      // 3. Add new channels (those without an id — never persisted yet)
      // Split in chunks of 50 to stay within API limits, send in parallel
      const newChannels = channels.filter((c) => !c.id);
      if (newChannels.length > 0) {
        const BATCH_SIZE = 50;
        const chunks = Array.from(
          { length: Math.ceil(newChannels.length / BATCH_SIZE) },
          (_, i) => newChannels.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE),
        );
        const responses = await Promise.all(
          chunks.map(async (batch) =>
            fetch(`/api/lists/${listId}/channels`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ channels: batch }),
            }),
          ),
        );
        const failed = responses.find((r) => !r.ok);
        if (failed) {
          const d = (await failed.json()) as { error?: string };
          toast.error(d.error ?? "Failed to add channels");
          return;
        }
      }

      toast.success("List updated");
      router.push(`/lists/${listId}`);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    dialogManager.confirm({
      title: "Delete list",
      description:
        "This will permanently delete the list and unfollow all users who follow it. This cannot be undone.",
      variant: "destructive",
      action: {
        label: "Delete list",
        onClick: async () => {
          setDeleting(true);
          const res = await fetch(`/api/lists/${listId}`, { method: "DELETE" });
          if (!res.ok) {
            const d = (await res.json()) as { error?: string };
            toast.error(d.error ?? "Failed to delete list");
            setDeleting(false);
            return;
          }
          toast.success("List deleted");
          router.push("/lists");
        },
      },
    });
  };

  return (
    <div className="bg-background min-h-screen">
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-white/[0.06] bg-transparent backdrop-blur-2xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link
            href={`/lists/${listId}`}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to list
          </Link>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="nm-raised-sm text-muted-foreground rounded-full px-3 py-1 text-xs transition-all hover:text-red-400 disabled:opacity-50"
            >
              {deleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Delete list"
              )}
            </button>
            <Button
              type="submit"
              form="edit-list-form"
              disabled={submitting || !name.trim() || channels.length === 0}
              size="sm"
              className="rounded-full bg-red-600 hover:bg-red-500"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save changes
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-6">
        <form
          id="edit-list-form"
          onSubmit={(e) => void handleSave(e)}
          className="space-y-6"
          data-form-type="other"
          suppressHydrationWarning
        >
          {/* Details */}
          <section className="space-y-2">
            <h2 className="text-muted-foreground/50 px-1 text-xs font-medium tracking-wide uppercase">
              Details
            </h2>
            <div className="nm-raised overflow-hidden rounded-2xl">
              {/* Name */}
              <div className="px-4 py-3.5">
                <label className="text-muted-foreground mb-2 block text-xs font-medium">
                  Name
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={100}
                  className="nm-inset rounded-xl border-transparent bg-transparent focus-visible:ring-0"
                />
              </div>

              {/* Description */}
              <div className="border-t border-white/[0.04] px-4 py-3.5">
                <label className="text-muted-foreground mb-2 block text-xs font-medium">
                  Description{" "}
                  <span className="text-muted-foreground/40 font-normal">
                    (optional)
                  </span>
                </label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={500}
                  rows={3}
                  className="nm-inset rounded-xl border-transparent bg-transparent focus-visible:ring-0"
                />
              </div>

              {/* Category */}
              <div className="border-t border-white/[0.04] px-4 py-3.5">
                <label className="text-muted-foreground mb-2.5 block text-xs font-medium">
                  Category{" "}
                  <span className="text-muted-foreground/40 font-normal">
                    (optional)
                  </span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(category === cat ? "" : cat)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                        category === cat
                          ? "nm-inset text-red-400"
                          : "nm-raised-sm text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Channels */}
          <section className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-muted-foreground/50 text-xs font-medium tracking-wide uppercase">
                Channels{" "}
                <span className="normal-case">({channels.length})</span>
              </h2>
              <button
                type="button"
                onClick={() => void importFromSubscriptions()}
                disabled={importing}
                className="nm-raised-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-all disabled:opacity-50"
              >
                {importing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Download className="h-3 w-3" />
                )}
                Import subscriptions
              </button>
            </div>

            <div className="nm-raised overflow-hidden rounded-2xl">
              {/* URL input row */}
              <div className="flex items-center gap-2 px-4 py-3">
                <Input
                  type="text"
                  value={channelUrl}
                  onChange={(e) => {
                    setChannelUrl(e.target.value);
                    setChannelError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void addChannel();
                    }
                  }}
                  placeholder="youtube.com/@channel or channel ID"
                  className="nm-inset flex-1 rounded-xl border-transparent bg-transparent focus-visible:ring-0"
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                />
                <Button
                  type="button"
                  onClick={() => void addChannel()}
                  disabled={addingChannel || !channelUrl.trim()}
                  variant="outline"
                  className="shrink-0 rounded-full"
                >
                  {addingChannel ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {channelError && (
                <p className="px-4 pb-3 text-xs text-red-400">{channelError}</p>
              )}

              {channels.length > 0 && (
                <div className="divide-y divide-white/[0.04] border-t border-white/[0.04]">
                  {channels.map((ch) => (
                    <div
                      key={ch.channel_id}
                      className="flex items-center gap-3 px-4 py-2.5"
                    >
                      {ch.channel_avatar_url ? (
                        <Image
                          src={ch.channel_avatar_url}
                          alt={ch.channel_name}
                          width={28}
                          height={28}
                          suppressHydrationWarning
                          className="h-7 w-7 shrink-0 rounded-full"
                        />
                      ) : (
                        <div className="nm-inset-sm flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-xs font-bold text-red-400">
                          {ch.channel_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {ch.channel_name}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeChannel(ch.channel_id, ch.id)}
                        className="text-muted-foreground ml-2 shrink-0 transition-colors hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </form>
      </div>
    </div>
  );
}
