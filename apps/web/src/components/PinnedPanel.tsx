import type { PinnedField, Scenario } from '@chat/shared';
import type { FieldChange } from '../state/chatReducer';
import { ChangesStrip } from './ChangesStrip';
import { DirtyBand } from './DirtyBand';
import { PinnedFieldRow } from './PinnedField';
import { SavedScenarios } from './SavedScenarios';

export function PinnedPanel({
  fields,
  proposals = {},
  savedScenarios = [],
  dirtyKeys = [],
  changes = [],
  busy = false,
  onEdit,
  onAcceptProposal,
  onRejectProposal,
  onDeleteScenario,
  onRecalculate,
  onRevertChange,
  onDismissChanges,
}: {
  fields: PinnedField[];
  proposals?: Record<string, PinnedField>;
  savedScenarios?: Scenario[];
  dirtyKeys?: string[];
  changes?: FieldChange[];
  busy?: boolean;
  onEdit: (key: string, value: string) => void;
  onAcceptProposal?: (key: string) => void;
  onRejectProposal?: (key: string) => void;
  onDeleteScenario?: (id: string) => void;
  onRecalculate?: () => void;
  onRevertChange?: (key: string) => void;
  onDismissChanges?: () => void;
}) {
  const fieldsByKey = Object.fromEntries(fields.map((f) => [f.key, f]));

  return (
    <aside className="flex w-panel flex-none flex-col border-l border-ch-border">
      <div className="flex-none border-b border-ch-border px-[22px] pb-4 pt-[22px]">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-500">
            Datos de la operación
          </span>
          <span className="text-[11px] font-medium text-slate-400">{fields.length} fijados</span>
        </div>
        <div className="mt-3 flex items-center gap-[14px]">
          <span className="flex items-center gap-[6px] text-[11px] font-medium text-slate-400">
            <span className="h-[7px] w-[7px] rounded-full bg-slate-400" />
            Lo dijiste tú
          </span>
          <span className="flex items-center gap-[6px] text-[11px] font-medium text-ch-accent">
            <span className="h-[7px] w-[7px] rounded-full bg-ch-accent" />
            Lo asumí yo
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-[10px] py-2">
        <ChangesStrip
          changes={changes}
          onRevert={(k) => onRevertChange?.(k)}
          onDismiss={() => onDismissChanges?.()}
        />
        {fields.map((f) => (
          <PinnedFieldRow
            key={f.key}
            field={f}
            proposal={proposals[f.key]}
            onChange={onEdit}
            onAcceptProposal={onAcceptProposal}
            onRejectProposal={onRejectProposal}
          />
        ))}
        <SavedScenarios scenarios={savedScenarios} onDelete={(id) => onDeleteScenario?.(id)} />
      </div>

      <div className="flex-none border-t border-ch-border px-[22px] pb-6 pt-4">
        <DirtyBand
          fields={fieldsByKey}
          dirtyKeys={dirtyKeys}
          onRecalculate={() => onRecalculate?.()}
          busy={busy}
        />
        <button
          type="button"
          className="flex h-[46px] w-full items-center justify-center gap-2 rounded-full bg-slate-50 text-[13.5px] font-semibold text-ch-bg transition-opacity duration-120 ease-ch hover:opacity-90 active:translate-y-px"
        >
          Guardar como propiedad
        </button>
        <p className="mt-2 text-center text-[11px] font-medium text-slate-400">
          Entra a tu portafolio y podrás amortizar sobre ella.
        </p>
      </div>
    </aside>
  );
}
