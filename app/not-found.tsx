import Link from "next/link";
import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="bg-background min-h-screen">
      <Navbar />
      <main className="mx-auto flex max-w-lg flex-col items-center px-6 pt-48 pb-20 text-center">
        <p className="font-display text-8xl font-bold text-white/10">404</p>
        <h1 className="font-display mt-4 text-2xl font-bold">Page not found</h1>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          This page doesn't exist or has been moved.
        </p>
        <div className="mt-8 flex items-center gap-3">
          <Button
            className="bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.25)] hover:bg-red-500"
            asChild
          >
            <Link href="/">Go Home</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/blog">Read the Blog</Link>
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
}
