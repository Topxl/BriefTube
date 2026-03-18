"use client";

import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Rss, Youtube } from "@/lib/icons";
import { SourcesSection } from "@/components/dashboard/sources-section";
import type { Tables } from "@/types/supabase";

type Subscription = Tables<"subscriptions">;

type Props = {
  initialSources: Subscription[];
  maxChannels: number;
  isPro: boolean;
};

export function ChannelsSheet({ initialSources, maxChannels, isPro }: Props) {
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
        forceMount
        side={isMobile ? "bottom" : "right"}
        className={
          isMobile
            ? "h-[85dvh] overflow-y-auto p-0"
            : "overflow-y-auto p-0 sm:max-w-md"
        }
      >
        <SheetHeader className="border-b border-white/[0.04] px-4 py-3">
          <div className="flex items-center gap-3 pr-8">
            <SheetTitle className="text-sm">Channels</SheetTitle>
            <a
              href="/api/youtube/auth"
              className="text-muted-foreground/40 hover:text-muted-foreground flex items-center gap-1 text-xs transition-colors"
            >
              <Youtube className="h-3 w-3" />
              Import from YouTube
            </a>
          </div>
        </SheetHeader>
        <div className="p-4">
          <SourcesSection
            initialSources={initialSources}
            maxChannels={maxChannels}
            isPro={isPro}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
