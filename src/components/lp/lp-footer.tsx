import Link from "next/link";

export function LpFooter() {
  return (
    <footer className="border-t border-white/[0.06] py-8">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-center gap-3 text-center md:flex-row md:justify-between">
          <p className="text-muted-foreground text-sm">&copy; 2026 BriefTube</p>
          <div className="text-muted-foreground flex items-center gap-4 text-sm">
            <Link
              href="/privacy"
              className="hover:text-foreground transition-colors"
            >
              Privacy
            </Link>
            <span aria-hidden>·</span>
            <Link
              href="/terms"
              className="hover:text-foreground transition-colors"
            >
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
