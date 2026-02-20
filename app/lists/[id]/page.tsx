import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Youtube } from "@/lib/icons";
import { ListActions } from "@/components/lists/list-actions";
import { ShareListButton } from "@/components/lists/share-list-button";

type Props = { params: Promise<{ id: string }> };

export default async function ListDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: list } = await supabase
    .from("channel_lists")
    .select(
      `
      id, name, description, category, created_at, created_by, is_public,
      list_channels(id, channel_id, channel_name, channel_avatar_url, added_at),
      list_stars(count),
      list_follows(count)
    `,
    )
    .eq("id", id)
    .eq("is_public", true)
    .single();

  if (!list) notFound();

  const starCount =
    (list.list_stars as unknown as { count: number }[])[0]?.count ?? 0;
  const followCount =
    (list.list_follows as unknown as { count: number }[])[0]?.count ?? 0;

  let starred = false;
  let following = false;

  let referralCode: string | null = null;

  if (user) {
    const [starRow, followRow, profileRow] = await Promise.all([
      supabase
        .from("list_stars")
        .select("user_id")
        .eq("user_id", user.id)
        .eq("list_id", id)
        .maybeSingle(),
      supabase
        .from("list_follows")
        .select("user_id")
        .eq("user_id", user.id)
        .eq("list_id", id)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("referral_code")
        .eq("id", user.id)
        .single(),
    ]);
    starred = !!starRow.data;
    following = !!followRow.data;
    referralCode = profileRow.data?.referral_code ?? null;
  }

  const channels = list.list_channels as {
    id: string;
    channel_id: string;
    channel_name: string;
    channel_avatar_url: string | null;
  }[];

  return (
    <div className="bg-background min-h-screen">
      {/* Top bar */}
      <div className="border-b border-white/[0.06]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link
            href="/lists"
            className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Lists
          </Link>
          <div className="flex items-center gap-3">
            {user && (
              <ShareListButton listId={id} referralCode={referralCode} />
            )}
            {user && list.created_by === user.id && (
              <Link
                href={`/lists/${id}/edit`}
                className="text-muted-foreground hover:text-foreground text-xs transition-colors"
              >
                Edit list
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{list.name}</h1>
              {list.category && (
                <span className="text-muted-foreground rounded-full border border-white/[0.06] px-2 py-0.5 text-[10px]">
                  {list.category}
                </span>
              )}
            </div>
            {list.description && (
              <p className="text-muted-foreground mt-2 text-sm">
                {list.description}
              </p>
            )}
          </div>

          <ListActions
            listId={id}
            initialStarred={starred}
            initialFollowing={following}
            starCount={starCount}
            followCount={followCount}
            isAuthenticated={!!user}
          />
        </div>

        {/* Channels grid */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">
            {channels.length} channel{channels.length !== 1 ? "s" : ""}
          </h2>

          {channels.length === 0 ? (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] py-10 text-center">
              <p className="text-muted-foreground text-sm">
                No channels in this list yet.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/[0.06]">
              <div className="divide-y divide-white/[0.04]">
                {channels.map((ch) => (
                  <div
                    key={ch.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    {ch.channel_avatar_url ? (
                      <Image
                        src={ch.channel_avatar_url}
                        alt={ch.channel_name}
                        width={32}
                        height={32}
                        suppressHydrationWarning
                        className="h-8 w-8 shrink-0 rounded-full"
                      />
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-xs font-bold text-red-400">
                        {ch.channel_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {ch.channel_name}
                      </p>
                      <a
                        href={`https://www.youtube.com/channel/${ch.channel_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground text-[11px] transition-colors"
                      >
                        YouTube →
                      </a>
                    </div>
                    <Youtube className="text-muted-foreground h-4 w-4 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
