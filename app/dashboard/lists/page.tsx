import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Pencil, Star } from "@/lib/icons";
import { CreateListButton } from "@/components/lists/create-list-button";
import { FollowedListsSection } from "@/components/lists/followed-lists-section";
import { ShareListButton } from "@/components/lists/share-list-button";

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

function extractCount(val: unknown): number {
  return (val as { count: number }[])[0]?.count ?? 0;
}

export default async function DashboardListsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch referral code and my created lists in parallel
  const [{ data: myLists }, { data: profileData }] = await Promise.all([
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
  ]);

  const referralCode = profileData?.referral_code ?? null;

  // Followed lists
  const { data: followedRaw } = await supabase
    .from("list_follows")
    .select("list_id, channel_lists(id, name, category)")
    .eq("user_id", user.id);

  const followedItems = (followedRaw ?? []).map((item) => ({
    list_id: item.list_id,
    name:
      (item.channel_lists as { name: string } | null)?.name ?? "Unknown list",
    category:
      (item.channel_lists as { category: string | null } | null)?.category ??
      null,
  }));

  // Public discovery lists (excluding own)
  const publicQuery = supabase
    .from("channel_lists")
    .select("id, name, category, list_channels(count), list_stars(count)")
    .eq("is_public", true)
    .neq("created_by", user.id);

  const { data: publicLists } = category
    ? await publicQuery.eq("category", category)
    : await publicQuery;

  const sortedPublic = (publicLists ?? [])
    .map((l) => ({
      id: l.id,
      name: l.name,
      category: l.category,
      channelCount: extractCount(l.list_channels),
      starCount: extractCount(l.list_stars),
    }))
    .sort((a, b) => b.starCount - a.starCount);

  const myListsMapped = (myLists ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    category: l.category,
    channelCount: extractCount(l.list_channels),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold">Lists</h1>
        <CreateListButton />
      </div>

      {/* My lists */}
      {myListsMapped.length > 0 && (
        <section className="space-y-2">
          <p className="text-muted-foreground text-xs font-medium">Mine</p>
          <div className="overflow-hidden rounded-xl border border-white/[0.06]">
            <div className="divide-y divide-white/[0.04]">
              {myListsMapped.map((list) => (
                <div
                  key={list.id}
                  className="flex items-center justify-between px-4 py-3"
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
        </section>
      )}

      {/* Following */}
      <FollowedListsSection initialItems={followedItems} />

      {/* Discover */}
      <section className="space-y-3">
        <p className="text-muted-foreground text-xs font-medium">Discover</p>

        {/* Category chips */}
        <div className="flex flex-wrap gap-1.5">
          <Link
            href="/dashboard/lists"
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              !category
                ? "border-red-500/30 bg-red-500/[0.08] text-red-400"
                : "text-muted-foreground border-white/[0.08] hover:border-white/20"
            }`}
          >
            All
          </Link>
          {CATEGORIES.map((cat) => (
            <Link
              key={cat}
              href={`/dashboard/lists?category=${cat}`}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                category === cat
                  ? "border-red-500/30 bg-red-500/[0.08] text-red-400"
                  : "text-muted-foreground border-white/[0.08] hover:border-white/20"
              }`}
            >
              {cat}
            </Link>
          ))}
        </div>

        {/* List rows */}
        {sortedPublic.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            {category ? `No lists in ${category} yet.` : "No public lists yet."}
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/[0.06]">
            <div className="divide-y divide-white/[0.04]">
              {sortedPublic.map((list) => (
                <Link
                  key={list.id}
                  href={`/lists/${list.id}`}
                  className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-white/[0.03]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{list.name}</p>
                    <p className="text-muted-foreground mt-0.5 text-[11px]">
                      {list.channelCount} ch
                      {list.category ? ` · ${list.category}` : ""}
                    </p>
                  </div>
                  <div className="text-muted-foreground ml-3 flex shrink-0 items-center gap-1 text-xs">
                    <Star className="h-3 w-3" />
                    {list.starCount}
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
