"use client";

import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ListVideo, User } from "@/lib/icons";
import { ChannelSearchBar } from "@/components/dashboard/channel-search-bar";

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
  const onDashboard = pathname === "/dashboard";

  return (
    <>
      {/* Top bar */}
      <nav className="sticky top-0 z-40 border-b border-white/[0.06] bg-white/[0.03] backdrop-blur-2xl">
        <div className="mx-auto flex h-14 max-w-[1080px] items-center justify-between px-4 md:px-6">
          {/* Left: logo + nav links */}
          <div className="flex shrink-0 items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2">
              <Image
                src="/logo.svg"
                alt="BriefTube"
                width={26}
                height={26}
                suppressHydrationWarning
              />
              <span className="hidden text-sm font-semibold sm:inline">
                BriefTube
              </span>
            </Link>

            {/* Desktop nav links */}
            <div className="hidden items-center md:flex">
              {navItems.map((item) => {
                const active = isActive(item.href, pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative px-3 py-1.5 text-[13px] transition-colors duration-200 ${
                      active
                        ? "text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {item.label}
                    {active && (
                      <span className="absolute inset-x-3 -bottom-[17px] h-[2px] rounded-full bg-red-500" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Center: search bar — all screen sizes on dashboard */}
          {onDashboard && (
            <div className="mx-3 w-full flex-1 md:mx-6 md:max-w-sm">
              <Suspense fallback={null}>
                <ChannelSearchBar />
              </Suspense>
            </div>
          )}
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <nav className="fixed right-0 bottom-0 left-0 z-40 border-t border-white/[0.06] bg-black/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl md:hidden">
        <div className="flex h-16 items-stretch">
          {navItems.map((item) => {
            const active = isActive(item.href, pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-1 flex-col items-center justify-center gap-1 transition-colors ${
                  active ? "text-red-400" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2 : 1.5} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
