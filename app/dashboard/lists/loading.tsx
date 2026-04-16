import { Skeleton } from "@/components/ui/skeleton";

const g = "bg-white/[0.06]";

export default function ListsLoading() {
  return (
    <div className="space-y-8 px-0.5 pt-0.5 pb-4">
      <section className="space-y-3">
        <Skeleton className={`h-3 w-16 rounded ${g}`} />

        {/* Filter chips */}
        <div className="flex gap-2">
          <Skeleton className={`h-7 w-12 rounded-full ${g}`} />
          <Skeleton className={`h-7 w-20 rounded-full ${g}`} />
          <Skeleton className={`h-7 w-24 rounded-full ${g}`} />
        </div>

        {/* Category chips */}
        <div className="flex gap-2 overflow-hidden">
          <Skeleton className={`h-7 w-10 shrink-0 rounded-full ${g}`} />
          <Skeleton className={`h-7 w-14 shrink-0 rounded-full ${g}`} />
          <Skeleton className={`h-7 w-16 shrink-0 rounded-full ${g}`} />
          <Skeleton className={`h-7 w-16 shrink-0 rounded-full ${g}`} />
          <Skeleton className={`h-7 w-20 shrink-0 rounded-full ${g}`} />
          <Skeleton className={`h-7 w-14 shrink-0 rounded-full ${g}`} />
        </div>

        {/* List cards — match real ListCard: h-24 gradient header + text below */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="nm-raised flex flex-col overflow-hidden rounded-2xl"
            >
              <Skeleton className={`h-24 w-full rounded-none ${g}`} />
              <div className="flex flex-col gap-1.5 p-3">
                <Skeleton className={`h-3 w-20 rounded ${g}`} />
                <Skeleton className={`h-2.5 w-14 rounded ${g}`} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
