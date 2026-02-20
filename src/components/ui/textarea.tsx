import type * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "placeholder:text-muted-foreground/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 flex field-sizing-content min-h-16 w-full rounded-xl border border-white/[0.14] bg-white/[0.06] px-3 py-2 text-base shadow-xs backdrop-blur-sm transition-all duration-300 outline-none focus-visible:border-white/[0.3] focus-visible:bg-white/[0.08] focus-visible:shadow-[0_0_16px_rgba(255,255,255,0.06)] focus-visible:ring-[3px] focus-visible:ring-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
