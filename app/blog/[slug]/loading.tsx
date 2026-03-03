import { Skeleton } from "@/components/ui/skeleton";

export default function ArticleLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-10 px-6 pt-32 pb-20">
      {/* Back link */}
      <Skeleton className="h-3.5 w-16 rounded" />

      {/* Article header card */}
      <div className="nm-raised flex flex-col gap-4 rounded-2xl p-6">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-7 w-full rounded" />
        <Skeleton className="h-6 w-4/5 rounded" />
        <Skeleton className="h-4 w-2/3 rounded" />
        <div className="flex items-center gap-3 border-t border-white/[0.05] pt-3">
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="h-2 w-2 rounded-full" />
          <Skeleton className="h-3 w-16 rounded" />
        </div>
      </div>

      {/* Article body */}
      <div className="space-y-2.5">
        {[...Array(14)].map((_, i) => (
          <Skeleton
            key={i}
            className={`h-3 rounded ${
              i % 7 === 0
                ? "mt-4 mb-2 h-5 w-48"
                : i % 7 === 6
                  ? "w-2/3"
                  : "w-full"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
