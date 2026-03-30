"use client";

import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Rss, X } from "@/lib/icons";
import { SourcesSection } from "@/components/dashboard/sources-section";
import type { Tables } from "@/types/supabase";

type Subscription = Tables<"subscriptions">;

type FollowedListMeta = {
  list_id: string;
  name: string;
  channel_count: number;
};

type Props = {
  initialSources: Subscription[];
  followedLists?: FollowedListMeta[];
  maxChannels: number;
  isPro: boolean;
};

export function ChannelsSheet({
  initialSources,
  followedLists = [],
  maxChannels,
  isPro,
}: Props) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2">
          <Rss className="h-4 w-4" />
          <span className="text-xs font-medium">{initialSources.length}</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        showCloseButton={false}
        side={isMobile ? "bottom" : "right"}
        className={
          isMobile
            ? "h-[85dvh] gap-0 overflow-y-auto p-0"
            : "gap-0 overflow-y-auto p-0 sm:max-w-md"
        }
      >
        <SheetHeader className="border-b border-white/[0.04] px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-sm">Channels</SheetTitle>
              <span className="text-muted-foreground/40 text-xs tabular-nums">
                {initialSources.length}
              </span>
            </div>
            <SheetClose className="text-muted-foreground/50 hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </SheetClose>
          </div>
        </SheetHeader>
        <div className="px-4 pt-2 pb-4">
          <SourcesSection
            initialSources={initialSources}
            followedLists={followedLists}
            maxChannels={maxChannels}
            isPro={isPro}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
