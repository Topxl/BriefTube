import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Pencil, Users } from "@/lib/icons";
import { CreateListButton } from "@/components/lists/create-list-button";
import { ShareListButton } from "@/components/lists/share-list-button";
import { FollowButton } from "@/components/lists/follow-button";
import { UnfollowButton } from "@/components/lists/unfollow-button";

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
  "Business",
];

const CATEGORY_GRADIENTS: Record<string, string> = {
  Tech: "from-blue-500/25 to-blue-900/10",
  Finance: "from-green-500/25 to-green-900/10",
  Science: "from-violet-500/25 to-violet-900/10",
  Education: "from-orange-500/25 to-orange-900/10",
  Gaming: "from-red-500/25 to-red-900/10",
  News: "from-yellow-500/25 to-yellow-900/10",
  Entertainment: "from-pink-500/25 to-pink-900/10",
  Health: "from-teal-500/25 to-teal-900/10",
  Sports: "from-cyan-500/25 to-cyan-900/10",
  Business: "from-amber-500/25 to-amber-900/10",
};

const DEFAULT_GRADIENT = "from-zinc-500/20 to-zinc-900/10";

type Filter = "all" | "following" | "not-following";

type ChannelPreview = {
  avatar: string | null;
  name: string;
};

type ListData = {
  id: string;
  name: string;
  category: string | null;
  channelCount: number;
  followerCount?: number;
  channels: ChannelPreview[];
};

function extractCount(val: unknown): number {
  if (Array.isArray(val) && val.length > 0 && "count" in val[0]) {
    return (val as { count: number }[])[0].count;
  }
  return Array.isArray(val) ? val.length : 0;
}

function ListCard({
  list,
  actions,
  isFollowing,
}: {
  list: ListData;
  actions: React.ReactNode;
  isFollowing?: boolean;
}) {
  const gradient = CATEGORY_GRADIENTS[list.category ?? ""] ?? DEFAULT_GRADIENT;
  const previews = list.channels.slice(0, 4);

  return (
    <div
      className={`nm-raised flex flex-col overflow-hidden rounded-2xl transition-all hover:shadow-lg ${isFollowing ? "ring-1 ring-red-500/30" : ""}`}
    >
      {/* Visual header: avatar mosaic */}
      <Link href={`/lists/${list.id}`} className="block">
        <div className={`relative h-24 bg-gradient-to-br ${gradient} p-0.5`}>
          {previews.length >= 4 ? (
            <div className="grid h-full grid-cols-2 gap-0.5 overflow-hidden rounded-t-2xl">
              {previews.map((ch, i) =>
                ch.avatar ? (
                  <img
                    key={i}
                    src={ch.avatar}
                    alt={ch.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div
                    key={i}
                    className="bg-muted/40 flex h-full w-full items-center justify-center text-xs font-bold uppercase"
                  >
                    {ch.name.charAt(0)}
                  </div>
                ),
              )}
            </div>
          ) : previews.length > 0 ? (
            <div className="flex h-full gap-0.5 overflow-hidden rounded-t-2xl">
              {previews.map((ch, i) =>
                ch.avatar ? (
                  <img
                    key={i}
                    src={ch.avatar}
                    alt={ch.name}
                    className="h-full flex-1 object-cover"
                  />
                ) : (
                  <div
                    key={i}
                    className="bg-muted/40 flex h-full flex-1 items-center justify-center text-xs font-bold uppercase"
                  >
                    {ch.name.charAt(0)}
                  </div>
                ),
              )}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center rounded-t-2xl">
              <span className="text-muted-foreground/40 text-2xl font-bold uppercase">
                {list.name.charAt(0)}
              </span>
            </div>
          )}

          {/* Category badge */}
          {list.category && (
            <span className="absolute bottom-2 left-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white/70 backdrop-blur-sm">
              {list.category}
            </span>
          )}
        </div>
      </Link>

      {/* Content + actions */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div>
          <Link
            href={`/lists/${list.id}`}
            className="hover:text-foreground line-clamp-2 text-sm font-semibold transition-colors"
          >
            {list.name}
          </Link>
          <p className="text-muted-foreground mt-0.5 text-[11px]">
            {list.channelCount} channel{list.channelCount !== 1 ? "s" : ""}
            {list.followerCount != null
              ? ` · ${list.followerCount} follower${list.followerCount !== 1 ? "s" : ""}`
              : ""}
          </p>
        </div>
        <div className="mt-auto flex items-center gap-1.5">{actions}</div>
      </div>
    </div>
  );
}

export default async function DashboardListsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; filter?: string }>;
}) {
  const { category, filter: filterRaw } = await searchParams;
  const filter: Filter =
    filterRaw === "following" || filterRaw === "not-following"
      ? filterRaw
      : "all";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: myLists },
    { data: profileData },
    { data: followedRaw },
    { data: publicLists },
  ] = await Promise.all([
    supabase
      .from("channel_lists")
      .select(
        "id, name, category, list_channels(channel_avatar_url, channel_name)",
      )
      .eq("created_by", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("referral_code")
      .eq("id", user.id)
      .single(),
    supabase
      .from("list_follows")
      .select(
        "list_id, channel_lists(id, name, category, list_channels(channel_avatar_url, channel_name))",
      )
      .eq("user_id", user.id),
    (() => {
      const q = supabase
        .from("channel_lists")
        .select(
          "id, name, category, list_channels(channel_avatar_url, channel_name), list_follows(count)",
        )
        .eq("is_public", true)
        .neq("created_by", user.id);
      return category ? q.eq("category", category) : q;
    })(),
  ]);

  const referralCode = profileData?.referral_code ?? null;
  const followedListIds = new Set((followedRaw ?? []).map((r) => r.list_id));

  function parseChannels(raw: unknown): ChannelPreview[] {
    const arr = Array.isArray(raw) ? raw : [];
    return arr.slice(0, 4).map((ch: Record<string, unknown>) => ({
      avatar: (ch.channel_avatar_url as string | null) || null,
      name: (ch.channel_name as string) || "Unknown",
    }));
  }

  // My lists with channel previews
  const myListsMapped: ListData[] = (myLists ?? []).map(
    (l: Record<string, unknown>) => ({
      id: l.id as string,
      name: l.name as string,
      category: (l.category as string | null) ?? null,
      channelCount: extractCount(l.list_channels),
      channels: parseChannels(l.list_channels),
    }),
  );

  // Followed lists with channel previews, excluding ones user created
  const followedLists: ListData[] = (followedRaw ?? [])
    .map((r: Record<string, unknown>) => {
      const list = r.channel_lists as Record<string, unknown> | null;
      if (!list) return null;
      return {
        id: r.list_id as string,
        name: list.name as string,
        category: (list.category as string | null) ?? null,
        channelCount: extractCount(list.list_channels),
        channels: parseChannels(list.list_channels),
      };
    })
    .filter((x): x is ListData => x !== null)
    .filter((l) => !myListsMapped.some((m) => m.id === l.id));

  // Public lists with channel previews
  const allPublic: ListData[] = (publicLists ?? [])
    .map((l: Record<string, unknown>) => ({
      id: l.id as string,
      name: l.name as string,
      category: (l.category as string | null) || null,
      channelCount: extractCount(l.list_channels),
      followerCount: extractCount(l.list_follows),
      channels: parseChannels(l.list_channels),
    }))
    .sort((a, b) => (b.followerCount || 0) - (a.followerCount || 0));

  const sortedPublic = allPublic.filter((l) => {
    if (l.channelCount === 0) return false;
    if (filter === "following") return followedListIds.has(l.id);
    if (filter === "not-following") return !followedListIds.has(l.id);
    return true;
  });

  function filterHref(f: Filter) {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (f !== "all") params.set("filter", f);
    const qs = params.toString();
    return `/dashboard/lists${qs ? `?${qs}` : ""}`;
  }

  function categoryHref(cat?: string) {
    const params = new URLSearchParams();
    if (cat) params.set("category", cat);
    if (filter !== "all") params.set("filter", filter);
    const qs = params.toString();
    return `/dashboard/lists${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-8 px-0.5 pt-0.5 pb-4">
      {/* My lists */}
      {myListsMapped.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Mine
            </p>
            <CreateListButton variant="inline" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {myListsMapped.map((list) => (
              <ListCard
                key={list.id}
                list={list}
                isFollowing={followedListIds.has(list.id)}
                actions={
                  <div className="flex w-full items-center gap-1.5">
                    <FollowButton
                      listId={list.id}
                      initialFollowing={followedListIds.has(list.id)}
                    />
                    <ShareListButton
                      listId={list.id}
                      referralCode={referralCode}
                    />
                    <Link
                      href={`/lists/${list.id}/edit`}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* Discover */}
      <section className="space-y-3">
        <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
          Discover
        </p>

        {/* Filter + categories row */}
        <div className="space-y-2.5">
          {/* Filter chips */}
          <div className="flex gap-2">
            {(["all", "following", "not-following"] as Filter[]).map((f) => (
              <Link
                key={f}
                href={filterHref(f)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  filter === f
                    ? "nm-inset text-red-400"
                    : "nm-raised-sm text-muted-foreground hover:text-white/70"
                }`}
              >
                {f === "all"
                  ? "All"
                  : f === "following"
                    ? "Following"
                    : "Not following"}
              </Link>
            ))}
          </div>

          {/* Category chips: horizontal scroll, single row */}
          <div className="scrollbar-fade-x flex gap-2 overflow-x-auto py-1">
            <Link
              href={categoryHref()}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                !category
                  ? "nm-inset text-white"
                  : "nm-raised-sm text-muted-foreground hover:text-white/70"
              }`}
            >
              All
            </Link>
            {CATEGORIES.map((cat) => (
              <Link
                key={cat}
                href={categoryHref(cat)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  category === cat
                    ? "nm-inset text-white"
                    : "nm-raised-sm text-muted-foreground hover:text-white/70"
                }`}
              >
                {cat}
              </Link>
            ))}
          </div>
        </div>

        {/* List cards grid */}
        {sortedPublic.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            {filter === "following"
              ? "You're not following any lists yet."
              : filter === "not-following"
                ? "You're following all available lists!"
                : category
                  ? `No lists in ${category} yet.`
                  : "No public lists yet."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {sortedPublic.map((list) => (
              <ListCard
                key={list.id}
                list={list}
                isFollowing={followedListIds.has(list.id)}
                actions={
                  <div className="flex w-full items-center gap-2">
                    <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
                      <Users className="h-3 w-3" />
                      {list.followerCount}
                    </span>
                    <FollowButton
                      listId={list.id}
                      initialFollowing={followedListIds.has(list.id)}
                    />
                  </div>
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
