"use client";

import { useState } from "react";
import { Loader2 } from "@/lib/icons";
import { toast } from "sonner";

type Props = {
  listId: string;
  listName: string;
  onUnfollowed: () => void;
};

export function UnfollowButton({ listId, listName, onUnfollowed }: Props) {
  const [loading, setLoading] = useState(false);

  const handleUnfollow = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/lists/${listId}/follow`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        following?: boolean;
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? "Failed to unfollow");
        return;
      }
      if (!data.following) {
        toast.success(`Unfollowed "${listName}"`);
        onUnfollowed();
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={() => void handleUnfollow()}
      disabled={loading}
      className="text-muted-foreground ml-3 shrink-0 text-xs transition-colors hover:text-red-400 disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Unfollow"}
    </button>
  );
}
