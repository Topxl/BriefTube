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
      className={`ml-2 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all disabled:opacity-50 ${
        following
          ? "nm-inset-sm text-red-400"
          : "nm-raised-sm text-white/50 hover:text-white/80"
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
        "Sub"
      )}
    </button>
  );
}
