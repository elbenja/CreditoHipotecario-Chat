/** Skeleton in the exact shape of the three metric cards — never a generic spinner. */
export function MetricSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-white/[.06] bg-ch-card px-5 py-[18px]"
          style={{ animation: `ch-shimmer 1.4s ${i * 120}ms linear infinite` }}
        >
          <div className="h-[10px] w-2/3 rounded bg-ch-border-hover" />
          <div className="mt-3 h-[24px] w-4/5 rounded bg-ch-border-hover" />
          <div className="mt-3 h-[10px] w-1/2 rounded bg-ch-border-hover" />
        </div>
      ))}
    </div>
  );
}
