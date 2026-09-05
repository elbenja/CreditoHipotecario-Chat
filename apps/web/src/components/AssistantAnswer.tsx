import type { AnalysisEnvelope } from '@chat/shared';
import { MetricCard } from './MetricCard';
import { Pill } from './Pill';
import { ScenarioCard } from './ScenarioCard';

export function AssistantAnswer({
  envelope,
  onFollowUp,
  onSaveScenario,
  savedIds = [],
}: {
  envelope: AnalysisEnvelope;
  onFollowUp: (text: string) => void;
  onSaveScenario?: (id: string) => void;
  savedIds?: string[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <img src="/assets/logo-mark.svg" alt="" className="h-4 w-4" />
        <span className="text-[12px] font-semibold text-slate-500">Análisis</span>
      </div>

      <h2 className="font-jakarta text-[19px] font-bold leading-[1.35] tracking-[-.02em] text-white">
        {envelope.verdict}
      </h2>

      {envelope.metrics.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
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
            <p key={i} className="text-[14.5px] leading-[1.6] text-slate-300">
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
        <div className="flex flex-wrap gap-[9px]">
          {envelope.followUps.map((f) => (
            <Pill key={f} onClick={() => onFollowUp(f)} className="text-[12.5px]">
              {f}
            </Pill>
          ))}
        </div>
      )}
    </div>
  );
}
