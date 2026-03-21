"use client";

import { useQuery } from "@tanstack/react-query";

type StatsData = {
  stats: { value: string; label: string }[];
};

async function fetchStats(): Promise<StatsData> {
  const res = await fetch("/api/stats");
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json() as Promise<StatsData>;
}

export function SocialProof() {
  const { data } = useQuery({
    queryKey: ["landing-stats"],
    queryFn: fetchStats,
    staleTime: 1000 * 60 * 60, // 1h
    gcTime: 1000 * 60 * 60 * 24,
  });

  if (!data?.stats.length) return <div className="h-[110px]" />;

  return (
    <div className="py-8">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-10 px-6">
        {data.stats.map((stat, i) => (
          <div key={stat.label} className="flex items-center gap-10">
            <div className="text-center">
              <p className="text-foreground text-2xl font-bold tabular-nums">
                {stat.value}
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {stat.label}
              </p>
            </div>
            {i < data.stats.length - 1 && (
              <div className="h-8 w-px bg-white/[0.08]" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
