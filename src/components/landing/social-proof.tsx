type Props = {
  stats?: { value: string; label: string }[];
};

export function SocialProof({ stats }: Props) {
  if (!stats?.length) return <div className="h-[110px]" />;

  return (
    <div className="py-8">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-10 px-6">
        {stats.map((stat, i) => (
          <div key={stat.label} className="flex items-center gap-10">
            <div className="text-center">
              <p className="text-foreground text-2xl font-bold tabular-nums">
                {stat.value}
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {stat.label}
              </p>
            </div>
            {i < stats.length - 1 && (
              <div className="h-8 w-px bg-white/[0.08]" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
