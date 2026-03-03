import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Pencil, Users } from "@/lib/icons";
import { CreateListButton } from "@/components/lists/create-list-button";
import { ShareListButton } from "@/components/lists/share-list-button";
import { FollowButton } from "@/components/lists/follow-button";

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
  "Other",
];

type Filter = "all" | "following" | "not-following";

function extractCount(val: unknown): number {
  return (val as { count: number }[])[0]?.count ?? 0;
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
      .select("id, name, category, list_channels(count)")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("referral_code")
      .eq("id", user.id)
      .single(),
    supabase.from("list_follows").select("list_id").eq("user_id", user.id),
    (() => {
      const q = supabase
        .from("channel_lists")
        .select("id, name, category, list_channels(count), list_follows(count)")
        .eq("is_public", true)
        .neq("created_by", user.id);
      return category ? q.eq("category", category) : q;
    })(),
  ]);

  const referralCode = profileData?.referral_code ?? null;
  const followedListIds = new Set((followedRaw ?? []).map((r) => r.list_id));

  const allPublic = (publicLists ?? [])
    .map((l) => ({
      id: l.id,
      name: l.name,
      category: l.category,
      channelCount: extractCount(l.list_channels),
      followerCount: extractCount(l.list_follows),
    }))
    .sort((a, b) => b.followerCount - a.followerCount);

  const sortedPublic = allPublic.filter((l) => {
    if (filter === "following") return followedListIds.has(l.id);
    if (filter === "not-following") return !followedListIds.has(l.id);
    return true;
  });

  const myListsMapped = (myLists ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    category: l.category,
    channelCount: extractCount(l.list_channels),
  }));

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
    <div className="space-y-6 px-0.5 pt-0.5 pb-2">
      {/* My lists */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            Mine
          </p>
          <CreateListButton variant="inline" />
        </div>
        {myListsMapped.length > 0 && (
          <div className="nm-raised overflow-hidden rounded-2xl">
            <div className="divide-y divide-white/[0.05]">
              {myListsMapped.map((list) => (
                <div
                  key={list.id}
                  className="flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-white/[0.02]"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/lists/${list.id}`}
                      className="hover:text-foreground truncate text-sm font-medium transition-colors"
                    >
                      {list.name}
                    </Link>
                    <p className="text-muted-foreground mt-0.5 text-[11px]">
                      {list.channelCount} ch
                      {list.category ? ` · ${list.category}` : ""}
                    </p>
                  </div>
                  <div className="ml-3 flex shrink-0 items-center gap-3">
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
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

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

          {/* Category chips — horizontal scroll, single row */}
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

        {/* List rows */}
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
          <div className="nm-raised overflow-hidden rounded-2xl">
            <div className="divide-y divide-white/[0.05]">
              {sortedPublic.map((list) => (
                <Link
                  key={list.id}
                  href={`/lists/${list.id}`}
                  className="flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-white/[0.02]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{list.name}</p>
                    <p className="text-muted-foreground mt-0.5 text-[11px]">
                      {list.channelCount} ch
                      {list.category ? ` · ${list.category}` : ""}
                    </p>
                  </div>
                  <div className="ml-3 flex shrink-0 items-center gap-1.5">
                    <span className="text-muted-foreground flex items-center gap-1 text-xs">
                      <Users className="h-3 w-3" />
                      {list.followerCount}
                    </span>
                    <FollowButton
                      listId={list.id}
                      initialFollowing={followedListIds.has(list.id)}
                    />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
