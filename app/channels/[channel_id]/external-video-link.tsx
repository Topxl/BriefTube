"use client";

import { ExternalLink } from "lucide-react";

export function ExternalVideoLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="text-muted-foreground/50 hover:text-muted-foreground inline-flex items-center gap-1 text-xs transition-colors"
    >
      <ExternalLink className="h-3 w-3" />
      YouTube
    </a>
  );
}
