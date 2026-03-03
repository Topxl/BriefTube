import { Skeleton } from "@/components/ui/skeleton";

export default function BlogLoading() {
  return (
    <div className="mx-auto max-w-6xl px-6 pt-32 pb-20">
      {/* Header */}
      <div className="mb-14 space-y-3">
        <Skeleton className="h-3 w-10 rounded" />
        <Skeleton className="h-9 w-56 rounded" />
        <Skeleton className="h-4 w-96 max-w-full rounded" />
      </div>

      {/* Card grid */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="nm-raised flex flex-col gap-4 rounded-2xl p-5"
          >
            <Skeleton className="h-5 w-20 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-4/5 rounded" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-full rounded" />
              <Skeleton className="h-3 w-4/5 rounded" />
            </div>
            <div className="flex justify-between border-t border-white/[0.05] pt-3">
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="h-3 w-16 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
