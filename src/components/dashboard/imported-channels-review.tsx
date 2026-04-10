"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, Search } from "@/lib/icons";
import { dialogManager } from "@/features/dialog-manager/dialog-manager";
import { createClient } from "@/lib/supabase/client";

type PausedChannel = {
  id: string;
  channel_id: string;
  channel_name: string;
  channel_avatar_url: string | null;
};

function ReviewContent({ onDone }: { onDone: () => void }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<PausedChannel[]>([]);
  const [selected, setSelected] = useState(new Set<string>());
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchChannels = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("subscriptions")
        .select("id, channel_id, channel_name, channel_avatar_url")
        .eq("user_id", user.id)
        .eq("paused_by_system", true)
        .eq("active", false)
        .order("channel_name", { ascending: true });
      if (!mounted) return;
      setChannels((data ?? []) as PausedChannel[]);
      setLoading(false);
    };
    void fetchChannels();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  const filtered = search.trim()
    ? channels.filter((c) =>
        c.channel_name.toLowerCase().includes(search.toLowerCase()),
      )
    : channels;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const c of filtered) next.add(c.id);
      return next;
    });
  };

  const clearAll = () => setSelected(new Set());

  const activate = async () => {
    if (selected.size === 0) return;
    setSubmitting(true);
    const ids: string[] = [...selected];
    const { error } = await supabase
      .from("subscriptions")
      .update({ active: true, paused_by_system: false })
      .in("id", ids);
    setSubmitting(false);
    if (error) {
      toast.error("Failed to activate channels");
      return;
    }
    toast.success(
      `${ids.length} channel${ids.length > 1 ? "s" : ""} activated`,
    );
    dialogManager.closeAll();
    onDone();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="text-muted-foreground py-6 text-center text-sm">
        No channels to review. You can manage your channels anytime from the
        dashboard.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        Select the channels you want to activate. Unselected channels stay
        paused and can be activated later.
      </p>

      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search channels..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="nm-inset text-foreground placeholder:text-muted-foreground w-full rounded-lg py-2 pr-3 pl-9 text-sm outline-none focus:ring-1 focus:ring-white/20"
        />
      </div>

      <div className="flex items-center justify-between text-xs">
        <div className="text-muted-foreground">
          {selected.size} of {channels.length} selected
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={selectAllVisible}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Select all{search ? " visible" : ""}
          </button>
          <span className="text-muted-foreground/40">·</span>
          <button
            onClick={clearAll}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="nm-inset max-h-[50vh] overflow-y-auto rounded-lg p-1">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-xs">
            No channels match your search.
          </p>
        ) : (
          <ul className="flex flex-col">
            {filtered.map((c) => {
              const isSelected = selected.has(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => toggle(c.id)}
                    className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors ${
                      isSelected ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                    }`}
                  >
                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                        isSelected
                          ? "border-red-500 bg-red-500"
                          : "border-white/20"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </div>
                    {c.channel_avatar_url ? (
                      <Image
                        src={c.channel_avatar_url}
                        alt=""
                        width={28}
                        height={28}
                        className="h-7 w-7 shrink-0 rounded-full"
                        unoptimized
                      />
                    ) : (
                      <div className="nm-inset h-7 w-7 shrink-0 rounded-full" />
                    )}
                    <span className="truncate text-sm">{c.channel_name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          onClick={() => dialogManager.closeAll()}
          disabled={submitting}
          className="nm-raised-sm text-muted-foreground hover:text-foreground rounded-full px-4 py-2 text-sm transition-all disabled:opacity-50"
        >
          Do it later
        </button>
        <button
          onClick={activate}
          disabled={selected.size === 0 || submitting}
          className="inline-flex items-center gap-2 rounded-full bg-red-500 px-5 py-2 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Activate {selected.size > 0 ? `${selected.size} ` : ""}
          channel{selected.size === 1 ? "" : "s"}
        </button>
      </div>
    </div>
  );
}

export function ImportedChannelsReview() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const openedRef = useRef(false);

  useEffect(() => {
    // Trigger on any `?imported` param — even imported=0 means the flow ran
    // and there may be paused_by_system channels from a prior duplicate call.
    const imported = searchParams.get("imported");
    if (imported === null || openedRef.current) return;
    openedRef.current = true;

    // Strip the query params so a refresh doesn't reopen the dialog
    const url = new URL(window.location.href);
    url.searchParams.delete("imported");
    url.searchParams.delete("skipped");
    window.history.replaceState({}, "", url.toString());

    // Check DB for paused channels — more reliable than URL count
    // (duplicate callbacks can cause imported=0 even when channels exist).
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("paused_by_system", true)
        .eq("active", false)
        .then(({ count }) => {
          if (!count || count === 0) return;
          dialogManager.custom({
            title: `${count} channel${count > 1 ? "s" : ""} imported from YouTube`,
            size: "lg",
            children: <ReviewContent onDone={() => router.refresh()} />,
          });
        });
    });
  }, [searchParams, router]);

  return null;
}
