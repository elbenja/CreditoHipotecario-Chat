import type { Metric } from '@chat/shared';

/** `index` staggers the entrance: each card rises 60ms after the one before. */
export function MetricCard({ metric, index = 0 }: { metric: Metric; index?: number }) {
  const negative = metric.delta?.startsWith('↓') || metric.delta?.startsWith('-');

  return (
    <div style={{ animationDelay: `${index * 60}ms` }} className="ch-rise min-w-[150px] flex-none rounded-xl border border-white/[.06] bg-ch-card px-[15px] py-[14px] shadow-[inset_0_1px_0_rgba(255,255,255,.04)] md:w-auto md:px-5 md:py-[18px]">
      <div className="text-[10px] font-semibold uppercase tracking-[.08em] text-slate-400">
        {metric.label}
      </div>
      <div className="tnum mt-2 whitespace-nowrap font-jakarta text-[23px] font-bold leading-none tracking-[-.02em] text-white md:text-[28px]">
        {metric.value}
      </div>
      {metric.delta && (
        // The change lands after its card: the figure first, then what it did.
        <div style={{ animationDelay: `${index * 60 + 180}ms` }} className={`ch-badge mt-2 text-[12px] font-medium ${negative ? 'text-ch-neg' : 'text-ch-pos'}`}>
          {metric.delta}
        </div>
      )}
      {metric.context && <div className="mt-1 text-[11px] text-slate-400">{metric.context}</div>}
    </div>
  );
}
