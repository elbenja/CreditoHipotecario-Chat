import type { Metric } from '@chat/shared';

export function MetricCard({ metric }: { metric: Metric }) {
  const negative = metric.delta?.startsWith('↓') || metric.delta?.startsWith('-');

  return (
    <div className="w-[150px] flex-none min-w-0 rounded-xl border border-white/[.06] bg-ch-card px-[15px] py-[14px] shadow-[inset_0_1px_0_rgba(255,255,255,.04)] md:w-auto md:px-5 md:py-[18px]">
      <div className="text-[10px] font-semibold uppercase tracking-[.08em] text-slate-400">
        {metric.label}
      </div>
      <div className="tnum mt-2 break-words font-jakarta text-[23px] font-bold leading-none tracking-[-.02em] text-white md:text-[28px]">
        {metric.value}
      </div>
      {metric.delta && (
        <div className={`mt-2 text-[12px] font-medium ${negative ? 'text-ch-neg' : 'text-ch-pos'}`}>
          {metric.delta}
        </div>
      )}
      {metric.context && <div className="mt-1 text-[11px] text-slate-400">{metric.context}</div>}
    </div>
  );
}
