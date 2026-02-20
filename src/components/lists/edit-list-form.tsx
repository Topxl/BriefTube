"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [channels, setChannels] = useState<ChannelEntry[]>(initialChannels);
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
      const newChannels = channels.filter((c) => !c.id);
      if (newChannels.length > 0) {
        await fetch(`/api/lists/${listId}/channels`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channels: newChannels }),
        });
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
      <div className="border-b border-white/[0.06]">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <Link
            href={`/lists/${listId}`}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to list
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="text-muted-foreground text-xs transition-colors hover:text-red-400 disabled:opacity-50"
          >
            {deleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              "Delete list"
            )}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Edit list</h1>
        </div>

        <form
          onSubmit={(e) => void handleSave(e)}
          className="space-y-6"
          data-form-type="other"
        >
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Description{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
              className="placeholder:text-muted-foreground/50 w-full rounded-xl border border-white/[0.14] bg-white/[0.06] px-3 py-2 text-sm transition-all duration-300 outline-none focus-visible:border-white/[0.3] focus-visible:bg-white/[0.08] focus-visible:shadow-[0_0_16px_rgba(255,255,255,0.06)] focus-visible:ring-[3px] focus-visible:ring-white/[0.08]"
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Category{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(category === cat ? "" : cat)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    category === cat
                      ? "border-red-500/30 bg-red-500/[0.08] text-red-400"
                      : "text-muted-foreground hover:text-foreground border-white/[0.08] hover:border-white/20"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Channels */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                Channels{" "}
                <span className="text-muted-foreground font-normal">
                  ({channels.length})
                </span>
              </label>
              <button
                type="button"
                onClick={() => void importFromSubscriptions()}
                disabled={importing}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs transition-colors disabled:opacity-50"
              >
                {importing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Download className="h-3 w-3" />
                )}
                Import my subscriptions
              </button>
            </div>

            <div className="flex gap-2">
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
                className="flex-1"
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
              />
              <Button
                type="button"
                onClick={() => void addChannel()}
                disabled={addingChannel || !channelUrl.trim()}
                variant="outline"
                className="shrink-0"
              >
                {addingChannel ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>

            {channelError && (
              <p className="text-xs text-red-400">{channelError}</p>
            )}

            {channels.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-white/[0.06]">
                <div className="divide-y divide-white/[0.04]">
                  {channels.map((ch) => (
                    <div
                      key={ch.channel_id}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      {ch.channel_avatar_url ? (
                        <Image
                          src={ch.channel_avatar_url}
                          alt={ch.channel_name}
                          width={28}
                          height={28}
                          className="h-7 w-7 shrink-0 rounded-full"
                        />
                      ) : (
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-xs font-bold text-red-400">
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
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={submitting || !name.trim()}
              className="bg-red-600 hover:bg-red-500"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
