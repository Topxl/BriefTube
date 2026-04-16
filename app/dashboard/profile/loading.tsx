import { Skeleton } from "@/components/ui/skeleton";

const g = "bg-white/[0.06]";

function SectionSkeleton({ title, rows }: { title: string; rows: number }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-muted-foreground/50 px-1 text-xs font-medium tracking-wide uppercase">
        {title}
      </h2>
      <div className="nm-raised divide-y divide-white/[0.06] overflow-hidden rounded-2xl">
        {[...Array(rows)].map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between px-4 py-3.5"
          >
            <div className="flex items-center gap-2.5">
              <Skeleton className={`h-8 w-8 shrink-0 rounded-lg ${g}`} />
              <div className="flex flex-col gap-1.5">
                <Skeleton className={`h-3 w-24 rounded ${g}`} />
                <Skeleton className={`h-2 w-32 rounded ${g}`} />
              </div>
            </div>
            <Skeleton className={`h-5 w-10 rounded-full ${g}`} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ProfileLoading() {
  return (
    <div className="flex flex-col gap-8">
      <SectionSkeleton title="Subscription" rows={1} />
      <SectionSkeleton title="Audio" rows={4} />
      <SectionSkeleton title="Platforms" rows={4} />
      <SectionSkeleton title="Summary preferences" rows={2} />
      <SectionSkeleton title="Notifications" rows={4} />
    </div>
  );
}
