import { Skeleton } from "@/components/ui/skeleton";

export default function VideoLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-10 px-6 pt-32 pb-20">
      {/* Back link */}
      <Skeleton className="h-3.5 w-28 rounded" />

      {/* Header card */}
      <div className="nm-raised flex flex-col gap-4 rounded-2xl p-6">
        <Skeleton className="aspect-video w-full rounded-xl" />
        <Skeleton className="h-6 w-4/5 rounded" />
        <Skeleton className="h-5 w-2/3 rounded" />
        <div className="flex items-center gap-3 border-t border-white/[0.05] pt-3">
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="h-2 w-2 rounded-full" />
          <Skeleton className="h-3 w-16 rounded" />
        </div>
      </div>

      {/* Summary */}
      <div className="space-y-2.5">
        <Skeleton className="mb-4 h-3 w-20 rounded" />
        {[...Array(10)].map((_, i) => (
          <Skeleton
            key={i}
            className={`h-3 rounded ${i % 5 === 4 ? "w-3/5" : "w-full"}`}
          />
        ))}
      </div>
    </div>
  );
}
