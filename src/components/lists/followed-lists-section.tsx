"use client";

import { useState } from "react";
import Link from "next/link";
import { UnfollowButton } from "@/components/lists/unfollow-button";

type FollowedItem = {
  list_id: string;
  name: string;
  category: string | null;
};

export function FollowedListsSection({
  initialItems,
}: {
  initialItems: FollowedItem[];
}) {
  const [items] = useState(initialItems);

  if (items.length === 0) return null;

  return (
    <section className="space-y-2">
      <p className="text-muted-foreground/50 px-1 text-xs font-medium tracking-wide uppercase">
        Following
      </p>
      <div className="nm-raised overflow-hidden rounded-2xl">
        <div className="divide-y divide-white/[0.04]">
          {items.map((item) => (
            <div
              key={item.list_id}
              className="flex items-center justify-between px-4 py-3"
            >
              <Link
                href={`/lists/${item.list_id}`}
                className="hover:text-foreground min-w-0 truncate text-sm font-medium transition-colors"
              >
                {item.name}
                {item.category && (
                  <span className="text-muted-foreground ml-1.5 text-[11px] font-normal">
                    {item.category}
                  </span>
                )}
              </Link>
              <UnfollowButton listId={item.list_id} listName={item.name} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
