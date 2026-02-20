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

function PlanBadge({ plan }: { plan: string }) {
  const isPro = plan === "active";
  const isTrial = plan === "trial";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${
        isPro
          ? "bg-red-600 text-white"
          : isTrial
            ? "border border-amber-500/30 bg-amber-500/10 text-amber-400"
            : "text-muted-foreground border border-white/[0.08] bg-white/[0.06]"
      }`}
    >
      {isPro ? "Pro" : isTrial ? "Trial" : "Free"}
    </span>
  );
}

export function DashboardNav({ email, plan }: { email: string; plan: string }) {
  const pathname = usePathname();
  const initial = email.charAt(0).toUpperCase();
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

          {/* Center: search bar — desktop only, dashboard only */}
          {onDashboard && (
            <div className="mx-6 hidden w-full max-w-sm flex-1 md:block">
              <Suspense fallback={null}>
                <ChannelSearchBar />
              </Suspense>
            </div>
          )}

          {/* Right: plan badge + avatar */}
          <div className="flex shrink-0 items-center gap-3">
            <PlanBadge plan={plan} />
            <Link
              href="/dashboard/profile"
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                isActive("/dashboard/profile", pathname)
                  ? "bg-red-500/20 text-red-400"
                  : "bg-white/[0.08] hover:bg-white/[0.12]"
              }`}
            >
              {initial}
            </Link>
          </div>
        </div>

        {/* Mobile search row — dashboard only */}
        {onDashboard && (
          <div className="border-t border-white/[0.04] px-4 pt-2 pb-3 md:hidden">
            <Suspense fallback={null}>
              <ChannelSearchBar />
            </Suspense>
          </div>
        )}
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
