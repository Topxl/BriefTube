type ProofStat = {
  value: string;
  label: string;
};

type LpProofBarProps = {
  stats: [ProofStat, ProofStat, ProofStat];
};

export function LpProofBar({ stats }: LpProofBarProps) {
  return (
    <section className="border-y border-white/[0.06] bg-white/[0.02] py-8">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-3 gap-6 text-center">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-1">
              <span className="font-display text-2xl font-bold text-red-500 md:text-3xl">
                {stat.value}
              </span>
              <span className="text-muted-foreground text-xs md:text-sm">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
