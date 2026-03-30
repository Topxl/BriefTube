"use client";

import { useState } from "react";
import { Loader2, Check } from "@/lib/icons";
import { toast } from "sonner";

type Props = {
  listId: string;
  initialFollowing: boolean;
};

export function FollowButton({ listId, initialFollowing }: Props) {
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault(); // the row is a <Link>, don't navigate
    e.stopPropagation();
    setLoading(true);
    try {
      const res = await fetch(`/api/lists/${listId}/follow`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        following?: boolean;
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        if (data.error === "upgrade_required") {
          toast.error("Pro subscription required to follow lists.");
        } else {
          toast.error(data.error ?? "Something went wrong");
        }
        return;
      }
      setFollowing(data.following ?? false);
      toast.success(data.following ? "List followed!" : "Unfollowed.");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={(e) => void toggle(e)}
      disabled={loading}
      suppressHydrationWarning
      className={`ml-auto shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition-all disabled:opacity-50 ${
        following
          ? "bg-red-500/15 text-red-400 ring-1 ring-red-500/30 hover:bg-red-500/25"
          : "nm-raised-sm text-white/60 hover:text-white"
      }`}
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : following ? (
        <span className="flex items-center gap-1">
          <Check className="h-2.5 w-2.5" />
          Following
        </span>
      ) : (
        "Follow"
      )}
    </button>
  );
}
