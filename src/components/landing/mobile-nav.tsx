"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { t } from "@/locales";

const tl = t.landing.nav;

const navLinks = [
  { label: tl.howItWorks, href: "#how-it-works" },
  { label: tl.features, href: "#features" },
  { label: tl.pricing, href: "#pricing" },
  { label: tl.faq, href: "#faq" },
];

export function LandingMobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">{tl.openMenu}</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72">
        <SheetHeader>
          <SheetTitle>{tl.menu}</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-4">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-white/[0.06]"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="mt-4 flex flex-col gap-3 px-4">
          <Button variant="ghost" asChild onClick={() => setOpen(false)}>
            <Link href="/login">{tl.logIn}</Link>
          </Button>
          <Button
            className="bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.25)] hover:bg-red-500"
            asChild
            onClick={() => setOpen(false)}
          >
            <Link href="/login">{tl.startFree}</Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
