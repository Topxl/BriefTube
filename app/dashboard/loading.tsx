import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-5">
      {/* Sources section */}
      <div className="nm-raised rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <Skeleton className="h-3 w-16 rounded" />
          <Skeleton className="h-7 w-24 rounded-full" />
        </div>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5">
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-2.5 w-36 rounded" />
                <Skeleton className="h-2 w-20 rounded" />
              </div>
              <Skeleton className="h-5 w-8 shrink-0 rounded-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="nm-raised rounded-2xl p-4">
        <Skeleton className="mb-3 h-3 w-24 rounded" />
        <div className="flex gap-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-28 rounded-full" />
          ))}
        </div>
      </div>

      {/* Summaries */}
      <div className="space-y-3">
        <Skeleton className="h-3.5 w-32 rounded" />
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
      </div>
    </div>
  );
}
