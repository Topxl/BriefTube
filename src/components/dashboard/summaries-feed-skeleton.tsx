import { Skeleton } from "@/components/ui/skeleton";

export function SummariesFeedSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="nm-raised flex items-center gap-3 rounded-2xl px-4 py-3"
        >
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-2.5 w-24 rounded" />
            <Skeleton className="h-2.5 w-48 rounded" />
          </div>
          <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}
