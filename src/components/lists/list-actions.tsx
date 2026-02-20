"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star, Users, Loader2 } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { dialogManager } from "@/features/dialog-manager/dialog-manager";

type Props = {
  listId: string;
  initialStarred: boolean;
  initialFollowing: boolean;
  starCount: number;
  followCount: number;
  isAuthenticated: boolean;
};

export function ListActions({
  listId,
  initialStarred,
  initialFollowing,
  starCount,
  followCount,
  isAuthenticated,
}: Props) {
  const router = useRouter();
  const [starred, setStarred] = useState(initialStarred);
  const [following, setFollowing] = useState(initialFollowing);
  const [starLoading, setStarLoading] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [localStarCount, setLocalStarCount] = useState(starCount);
  const [localFollowCount, setLocalFollowCount] = useState(followCount);

  const handleStar = async () => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    setStarLoading(true);
    try {
      const res = await fetch(`/api/lists/${listId}/star`, { method: "POST" });
      const data = (await res.json()) as { starred: boolean; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Failed to update star");
        return;
      }
      setStarred(data.starred);
      setLocalStarCount((prev) => prev + (data.starred ? 1 : -1));
    } catch {
      toast.error("Something went wrong");
    } finally {
      setStarLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    setFollowLoading(true);
    try {
      const res = await fetch(`/api/lists/${listId}/follow`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        following?: boolean;
        error?: string;
        message?: string;
      };

      if (res.status === 403 && data.error === "upgrade_required") {
        dialogManager.confirm({
          title: "Pro required",
          description:
            "Following curated lists requires a Pro subscription. Upgrade to receive summaries from all channels in this list.",
          variant: "default",
          action: {
            label: "Upgrade to Pro",
            onClick: async () => {
              window.location.href = "/dashboard/billing";
            },
          },
        });
        return;
      }

      if (!res.ok) {
        toast.error(data.error ?? "Failed to update follow");
        return;
      }

      setFollowing(data.following ?? false);
      setLocalFollowCount(
        (prev) => prev + ((data.following ?? false) ? 1 : -1),
      );
      toast.success(
        data.following
          ? "Following list — summaries from these channels will be delivered to you"
          : "Unfollowed list",
      );
    } catch {
      toast.error("Something went wrong");
    } finally {
      setFollowLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => void handleStar()}
        disabled={starLoading}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
          starred
            ? "border-amber-500/25 bg-amber-500/[0.08] text-amber-400"
            : "text-muted-foreground hover:text-foreground border-white/[0.08] hover:border-white/20"
        }`}
      >
        {starLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Star className={`h-3.5 w-3.5 ${starred ? "fill-amber-400" : ""}`} />
        )}
        {localStarCount}
      </button>

      <Button
        size="sm"
        onClick={() => void handleFollow()}
        disabled={followLoading}
        className={
          following
            ? "text-foreground border border-white/[0.08] bg-transparent hover:bg-white/[0.04]"
            : "bg-red-600 hover:bg-red-500"
        }
        variant={following ? "outline" : "default"}
      >
        {followLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Users className="h-3.5 w-3.5" />
        )}
        {following ? "Following" : "Follow"} · {localFollowCount}
      </Button>
    </div>
  );
}
