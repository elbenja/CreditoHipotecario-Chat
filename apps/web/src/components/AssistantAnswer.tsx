import type { AnalysisEnvelope } from '@chat/shared';
import { MetricCard } from './MetricCard';
import { Pill } from './Pill';
import { ScenarioCard } from './ScenarioCard';

export function AssistantAnswer({
  envelope,
  onFollowUp,
  onSaveScenario,
  savedIds = [],
  disabled,
}: {
  envelope: AnalysisEnvelope;
  onFollowUp: (text: string) => void;
  onSaveScenario?: (id: string) => void;
  savedIds?: string[];
  disabled?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-[13px] md:gap-4">
      <div className="flex items-center gap-2">
        <img src="/assets/logo-mark.svg" alt="" className="h-4 w-4" />
        <span className="text-[11.5px] font-semibold text-slate-500 md:text-[12px]">Análisis</span>
      </div>

      <h2 className="font-jakarta text-[17px] font-bold leading-[1.35] tracking-[-.02em] text-white md:text-[19px]">
        {envelope.verdict}
      </h2>

      {envelope.metrics.length > 0 && (
        <div className="ch-scrollbar-none -mr-5 flex min-w-0 gap-[9px] overflow-x-auto pr-10 md:mr-0 md:grid md:grid-cols-3 md:gap-3 md:overflow-visible md:pr-0">
          {envelope.metrics.map((m) => (
            <MetricCard key={m.label} metric={m} />
          ))}
        </div>
      )}

      {envelope.sources.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium text-slate-500">Fuentes</span>
          {envelope.sources.map((s) => (
            <span key={s} className="rounded-full bg-ch-card px-[9px] py-[3px] text-[11px] text-slate-400">
              {s}
            </span>
          ))}
        </div>
      )}

      {envelope.prose.length > 0 && (
        <div className="flex flex-col gap-[11px]">
          {envelope.prose.map((p, i) => (
            <p key={i} className="text-[13.5px] leading-[1.6] text-slate-300 md:text-[14.5px]">
              {p}
            </p>
          ))}
        </div>
      )}

      {envelope.scenarios.length > 0 && (
        <>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-500">
              Qué pasa si mueves una palanca
            </span>
            <div className="h-px flex-1 bg-ch-border" />
            <span className="text-[11px] font-medium text-slate-400">aproximados, no cotizaciones</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {envelope.scenarios.map((s) => (
              <ScenarioCard
                key={s.id}
                scenario={s}
                saved={savedIds.includes(s.id)}
                onSave={onSaveScenario}
              />
            ))}
          </div>
        </>
      )}

      {envelope.followUps.length > 0 && (
        <div className="ch-scrollbar-none -mr-5 hidden flex-nowrap gap-[9px] overflow-x-auto pr-10 md:mr-0 md:flex md:flex-wrap md:overflow-visible md:pr-0">
          {envelope.followUps.map((f) => (
            <Pill key={f} onClick={() => onFollowUp(f)} className="flex-none text-[12.5px]" disabled={disabled}>
              {f}
            </Pill>
          ))}
        </div>
      )}
    </div>
  );
}
