import type { MortgageField, PinnedField, Scenario } from '@chat/shared';
import type { FieldChange } from '../state/chatReducer';
import { ChangesStrip } from './ChangesStrip';
import { DirtyBand } from './DirtyBand';
import { FieldGroup } from './FieldGroup';
import { PinnedFieldRow } from './PinnedField';
import { SavedScenarios } from './SavedScenarios';
import { Icon } from './Icon';

export function PinnedPanel({
  fields,
  mortgage = [],
  mortgageChanges = {},
  mortgageRevision = 0,
  proposals = {},
  savedScenarios = [],
  dirtyKeys = [],
  changes = [],
  busy = false,
  onEdit,
  onEditMortgage,
  onAcceptProposal,
  onRejectProposal,
  onDeleteScenario,
  onRecalculate,
  onRevertChange,
  onDismissChanges,
  mode = 'desktop',
}: {
  fields: PinnedField[];
  mortgage?: MortgageField[];
  /** Cards 12/13: what the last schedule changed, and which revision it was. */
  mortgageChanges?: Record<string, string | null>;
  mortgageRevision?: number;
  proposals?: Record<string, PinnedField>;
  savedScenarios?: Scenario[];
  dirtyKeys?: string[];
  changes?: FieldChange[];
  busy?: boolean;
  onEdit: (key: string, value: string) => void;
  onEditMortgage?: (key: string, value: string) => void;
  onAcceptProposal?: (key: string) => void;
  onRejectProposal?: (key: string) => void;
  onDeleteScenario?: (id: string) => void;
  onRecalculate?: () => void;
  onRevertChange?: (key: string) => void;
  onDismissChanges?: () => void;
  mode?: 'desktop' | 'mobile';
}) {
  const fieldsByKey = Object.fromEntries(fields.map((f) => [f.key, f]));

  const mobile = mode === 'mobile';
  return (
    <aside
      className={
        mobile
          ? 'flex h-full min-h-0 w-full flex-col bg-ch-panel'
          : 'hidden w-panel flex-none flex-col border-l border-ch-border md:flex'
      }
    >
      <div
        className={`flex-none border-b border-ch-border ${mobile ? 'px-5 pb-[14px] pt-0' : 'px-[22px] pb-4 pt-[22px]'}`}
      >
        <div className="flex items-baseline justify-between">
          <span
            className={`${mobile ? 'text-[11px] text-slate-400' : 'text-[10px] text-slate-500'} font-semibold uppercase tracking-[.1em]`}
          >
            Datos de la operación
          </span>
          {/* Both groups count: a panel showing four credit rows under "0 fijados"
              contradicts itself. */}
          <span className="text-[11px] font-medium text-slate-400">
            {fields.length + mortgage.length} fijados
          </span>
        </div>
        <div className={`${mobile ? 'mt-[11px]' : 'mt-3'} flex items-center gap-[14px]`}>
          <span className="flex items-center gap-[6px] text-[11px] font-medium text-slate-400">
            <span className="h-[7px] w-[7px] rounded-full bg-slate-400" />
            Lo dijiste tú
          </span>
          <span className="flex items-center gap-[6px] text-[11px] font-medium text-ch-accent">
            <span className="h-[7px] w-[7px] rounded-full bg-ch-accent" />
            Lo asumí yo
          </span>
          {mortgage.some((f) => f.provenance === 'documento') && (
            <span className="flex items-center gap-[6px] text-[11px] font-medium text-emerald-400">
              <span className="h-[7px] w-[7px] rounded-full bg-emerald-400" />
              Lo leí del banco
            </span>
          )}
        </div>
      </div>

      <div className={`${mobile ? 'ch-scrollbar-none ' : ''}min-h-0 flex-1 overflow-y-auto ${mobile ? 'px-[14px] py-1' : 'px-[10px] py-2'}`}>
        <ChangesStrip
          changes={changes}
          onRevert={(k) => onRevertChange?.(k)}
          onDismiss={() => onDismissChanges?.()}
        />
        <FieldGroup title="Propiedad" count={fields.length}>
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
        </FieldGroup>
        <FieldGroup
          title="Hipoteca"
          count={mortgage.length}
          notice={{ count: Object.keys(mortgageChanges).length, revision: mortgageRevision }}
          divider={fields.length > 0}
        >
          {mortgage.map((f) => (
            <PinnedFieldRow
              key={f.key}
              field={f}
              change={mortgageChanges[f.key]}
              onChange={(key, value) => onEditMortgage?.(key, value)}
            />
          ))}
        </FieldGroup>
        <SavedScenarios scenarios={savedScenarios} onDelete={(id) => onDeleteScenario?.(id)} />
      </div>

      <div
        className={`flex-none border-t border-ch-border ${mobile ? 'mobile-safe-bottom px-5 pb-[14px] pt-[14px]' : 'px-[22px] pb-6 pt-4'}`}
      >
        <DirtyBand
          fields={fieldsByKey}
          dirtyKeys={dirtyKeys}
          onRecalculate={() => onRecalculate?.()}
          busy={busy}
        />
        <button
          type="button"
          className={`flex w-full items-center justify-center gap-2 rounded-full bg-slate-50 font-semibold text-ch-bg transition-opacity duration-120 ease-ch hover:opacity-90 active:translate-y-px ${mobile ? 'h-[50px] text-[14.5px]' : 'h-[46px] text-[13.5px]'}`}
        >
          {mobile && <Icon name="plus-sign" size={17} />}
          Guardar como propiedad
        </button>
        {!mobile && (
          <p className="mt-2 text-center text-[11px] font-medium text-slate-400">
            Entra a tu portafolio y podrás amortizar sobre ella.
          </p>
        )}
      </div>
    </aside>
  );
}
