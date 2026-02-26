"use client";

import { Button } from "@/components/ui/button";

export default function OnboardingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-sm font-medium">Something went wrong</p>
      <p className="text-muted-foreground mt-1 text-xs">{error.message}</p>
      <Button size="sm" variant="outline" className="mt-4" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
