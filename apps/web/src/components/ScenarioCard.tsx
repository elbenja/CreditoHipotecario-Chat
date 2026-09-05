import type { Scenario } from '@chat/shared';
import { Icon } from './Icon';

const TONE: Record<Scenario['tone'], string> = {
  good: 'text-ch-pos',
  tradeoff: 'text-ch-accent',
  bad: 'text-ch-neg',
};

export function ScenarioCard({
  scenario,
  saved = false,
  onSave,
}: {
  scenario: Scenario;
  saved?: boolean;
  onSave?: (id: string) => void;
}) {
  return (
    <div className="flex w-[196px] flex-col gap-2 rounded-xl border border-ch-border bg-ch-panel p-[14px] transition-colors duration-180 ease-ch hover:border-ch-border-hover">
      <div className="text-[10px] font-semibold uppercase tracking-[.08em] text-slate-500">
        {scenario.cause}
      </div>
      <div className="flex items-baseline gap-[5px]">
        <span className={`tnum font-jakarta text-[20px] font-bold ${TONE[scenario.tone]}`}>
          {scenario.value}
        </span>
        <span className="text-[11px] text-slate-400">{scenario.unit}</span>
      </div>
      <p className="flex-1 text-[11px] font-medium leading-[1.45] text-slate-400">{scenario.note}</p>
      <button
        type="button"
        onClick={() => onSave?.(scenario.id)}
        className="flex h-8 items-center justify-center gap-[6px] rounded-full border border-ch-border-hover text-[11.5px] font-semibold text-slate-300 transition-colors duration-180 ease-ch hover:border-slate-500"
      >
        <Icon name="bookmark-add-02" size={13} />
        {saved ? 'Guardado' : 'Guardar'}
      </button>
    </div>
  );
}
