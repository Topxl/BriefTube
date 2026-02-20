"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Users, Youtube } from "@/lib/icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type FollowedList = {
  list_id: string;
  channel_lists: {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    created_by: string;
  };
};

type Props = {
  initialFollowedLists: FollowedList[];
  isPro: boolean;
};

export function ListsSection({ initialFollowedLists, isPro }: Props) {
  const [followedLists, setFollowedLists] =
    useState<FollowedList[]>(initialFollowedLists);
  const [unfollowing, setUnfollowing] = useState<string | null>(null);

  const handleUnfollow = async (listId: string, listName: string) => {
    setUnfollowing(listId);
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
        setFollowedLists((prev) => prev.filter((l) => l.list_id !== listId));
        toast.success(`Unfollowed "${listName}"`);
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setUnfollowing(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Lists</h2>
          <p className="text-muted-foreground text-xs">
            Curated channel collections you follow
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/lists">
            <ExternalLink className="h-3.5 w-3.5" />
            Browse
          </Link>
        </Button>
      </div>

      {followedLists.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] py-8 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03]">
            <Users className="text-muted-foreground h-5 w-5" />
          </div>
          <p className="text-sm font-medium">No lists followed yet</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Follow a list to receive summaries from curated channel collections.
          </p>
          {!isPro && (
            <p className="text-muted-foreground mt-2 text-xs">
              Following lists requires a{" "}
              <Link
                href="/dashboard/billing"
                className="text-red-400 hover:underline"
              >
                Pro subscription
              </Link>
              .
            </p>
          )}
          <Button size="sm" variant="outline" className="mt-4" asChild>
            <Link href="/lists">
              <Youtube className="h-3.5 w-3.5" />
              Discover lists
            </Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/[0.06]">
          <div className="divide-y divide-white/[0.04]">
            {followedLists.map((item) => (
              <div
                key={item.list_id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/lists/${item.list_id}`}
                    className="hover:text-foreground truncate text-sm font-medium transition-colors"
                  >
                    {item.channel_lists.name}
                  </Link>
                  {item.channel_lists.category && (
                    <p className="text-muted-foreground mt-0.5 text-[11px]">
                      {item.channel_lists.category}
                    </p>
                  )}
                </div>
                <button
                  onClick={() =>
                    void handleUnfollow(item.list_id, item.channel_lists.name)
                  }
                  disabled={unfollowing === item.list_id}
                  className="text-muted-foreground ml-3 shrink-0 text-xs transition-colors hover:text-red-400 disabled:opacity-50"
                >
                  {unfollowing === item.list_id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    "Unfollow"
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
