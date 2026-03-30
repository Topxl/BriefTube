"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Shield } from "@/lib/icons";

const PAGES: Record<string, string> = {
  "/dashboard/admin/emails/survey": "Survey Results",
  "/dashboard/admin/monitoring": "Monitoring",
  "/dashboard/admin/emails": "Emails",
};

export function AdminBreadcrumb() {
  const pathname = usePathname();

  const key = Object.keys(PAGES).find((k) => pathname.startsWith(k));
  if (!key) return null;

  return (
    <div className="mb-4 flex items-center gap-1.5 text-sm">
      <Link
        href="/dashboard/admin"
        className="text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
      >
        <Shield className="size-3.5" />
        <span>Admin</span>
      </Link>
      <ChevronRight className="text-muted-foreground/40 size-3.5" />
      <span className="text-foreground font-medium">{PAGES[key]}</span>
    </div>
  );
}
