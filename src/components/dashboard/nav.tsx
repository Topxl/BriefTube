"use client";

import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, ListVideo, User } from "@/lib/icons";
import { ChannelSearchBar } from "@/components/dashboard/channel-search-bar";
import { createClient } from "@/lib/supabase/client";

function useRecentDeliveriesCount() {
  const { data = 0 } = useQuery({
    queryKey: ["recent-deliveries-count"],
    queryFn: async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return 0;
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: n } = await supabase
        .from("deliveries")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "sent")
        .gte("created_at", since);
      return n ?? 0;
    },
    staleTime: 1000 * 60 * 5, // 5 min — pas besoin de refetch à chaque navigation
    gcTime: 1000 * 60 * 10,
  });
  return data;
}

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Lists", href: "/dashboard/lists", icon: ListVideo },
  { label: "Profile", href: "/dashboard/profile", icon: User },
];

function isActive(href: string, pathname: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}

export function DashboardNav() {
  const pathname = usePathname();
  const recentCount = useRecentDeliveriesCount();

  return (
    <>
      {/* Top bar */}
      <nav className="sticky top-0 z-40 border-b border-white/[0.06] bg-transparent backdrop-blur-2xl">
        <div className="mx-auto flex h-14 max-w-[1080px] items-center justify-between px-4 md:px-6">
          {/* Left: logo + nav links */}
          <div className="flex shrink-0 items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2">
              <Image
                src="/favicon.svg"
                alt="BriefTube"
                width={30}
                height={30}
                priority
                suppressHydrationWarning
              />
              <span className="hidden text-sm font-semibold sm:inline">
                BriefTube
              </span>
            </Link>

            {/* Desktop nav links */}
            <div className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => {
                const active = isActive(item.href, pathname);
                const showBadge = item.href === "/dashboard" && recentCount > 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative rounded-full px-3 py-1.5 text-[13px] transition-colors duration-150 ${
                      active
                        ? "text-foreground font-medium shadow-[inset_3px_3px_8px_rgba(0,0,0,0.7),inset_-2px_-2px_5px_rgba(255,255,255,0.07)]"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {item.label}
                    {showBadge && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 animate-pulse items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
                        {recentCount > 9 ? "9+" : recentCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Center: search bar — always visible */}
          <div className="mx-3 w-full flex-1 md:mx-6 md:max-w-sm">
            <Suspense fallback={null}>
              <ChannelSearchBar />
            </Suspense>
          </div>
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <nav className="fixed right-0 bottom-0 left-0 z-40 border-t border-white/[0.06] bg-[oklch(0.13_0_0)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl md:hidden">
        <div className="flex items-stretch">
          {navItems.map((item) => {
            const active = isActive(item.href, pathname);
            const Icon = item.icon;
            const showBadge = item.href === "/dashboard" && recentCount > 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-1 flex-col items-center gap-1 py-2.5"
              >
                {/* Icon bubble */}
                <div
                  className={`relative rounded-xl px-3 py-1 transition-colors duration-200 ${
                    active ? "bg-red-600/[0.15]" : ""
                  }`}
                >
                  <Icon
                    className={`h-[22px] w-[22px] transition-colors duration-200 ${
                      active ? "text-red-400" : "text-white/40"
                    }`}
                    strokeWidth={active ? 2.5 : 1.5}
                  />
                  {showBadge && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-[oklch(0.13_0_0)]">
                      {recentCount > 9 ? "9+" : recentCount}
                    </span>
                  )}
                </div>
                {/* Label */}
                <span
                  className={`text-[10px] font-medium transition-colors duration-200 ${
                    active ? "text-red-400" : "text-white/40"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
