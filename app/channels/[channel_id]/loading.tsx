import { Skeleton } from "@/components/ui/skeleton";

export default function ChannelLoading() {
  return (
    <>
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-white/[0.06] backdrop-blur-2xl">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Skeleton className="h-5 w-24 rounded" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        {/* Channel header */}
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 shrink-0 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40 rounded" />
            <Skeleton className="h-3 w-24 rounded" />
          </div>
        </div>

        {/* Stats pills */}
        <div className="flex flex-wrap gap-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-9 w-36 rounded-full" />
          ))}
        </div>

        {/* Video cards */}
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="nm-raised rounded-2xl p-4">
              <div className="flex gap-4">
                <Skeleton className="h-[90px] w-[160px] shrink-0 rounded-xl" />
                <div className="flex flex-1 flex-col gap-2.5">
                  <Skeleton className="h-3.5 w-full rounded" />
                  <Skeleton className="h-3 w-4/5 rounded" />
                  <Skeleton className="h-3 w-3/5 rounded" />
                  <Skeleton className="mt-1 h-3 w-16 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
