import type { PinnedField } from '@chat/shared';
import { Icon } from './Icon';

export function PinnedFieldRow({
  field,
  proposal,
  onChange,
  onAcceptProposal,
  onRejectProposal,
}: {
  field: PinnedField;
  proposal?: PinnedField;
  onChange: (key: string, value: string) => void;
  onAcceptProposal?: (key: string) => void;
  onRejectProposal?: (key: string) => void;
}) {
  // Provenance is the whole point: a value the user did not state must never
  // read as fact. Anything that is not 'user' gets the accent dot — the live
  // model also returns 'market', and testing `=== 'assumed'` would render a
  // market estimate as "Lo dijiste tú".
  const notFromUser = field.provenance !== 'user';

  return (
    <div className="rounded-[10px] border border-transparent px-3 py-[11px] transition-colors duration-180 ease-ch hover:border-ch-border">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-500">
          {field.label}
        </span>
        <span
          className={`h-[6px] w-[6px] rounded-full ${notFromUser ? 'bg-ch-accent' : 'bg-slate-400'}`}
          title={notFromUser ? 'Lo asumí yo' : 'Lo dijiste tú'}
        />
        <div className="flex-1" />
        <Icon name="edit-01" size={13} className="text-slate-500" />
      </div>

      <div className="mt-[7px] flex items-baseline gap-[5px]">
        {field.prefix && (
          <span className="font-jakarta text-[14px] font-bold text-slate-500">{field.prefix}</span>
        )}
        <input
          value={field.value}
          onChange={(e) => onChange(field.key, e.target.value)}
          className="tnum min-w-0 flex-1 border-none bg-transparent p-0 font-jakarta text-[17px] font-bold tracking-[-.02em] text-white outline-none"
          aria-label={field.label}
        />
        {field.suffix && <span className="text-[14px] text-slate-400">{field.suffix}</span>}
      </div>

      {field.note && (
        <p className="mt-[5px] text-[11px] font-medium leading-[1.45] text-slate-400">{field.note}</p>
      )}

      {/*
        The model proposed a different value but this field is the user's.
        Neutral treatment, not #F4BC44 — the accent is capped at four
        placements on Screen 2 and this would be a fifth. Follows the E4
        pattern instead: information-circle on a plain border.
      */}
      {proposal && (
        <div className="mt-[9px] rounded-lg border border-ch-border-hover px-[11px] py-[9px]">
          <div className="flex items-center gap-[6px] text-[11px] font-medium text-slate-400">
            <Icon name="information-circle" size={13} />
            Sugerí {proposal.value}
            {field.suffix ? ` ${field.suffix}` : ''} · mantuve el tuyo
          </div>
          <div className="mt-[7px] flex gap-[6px]">
            <button
              type="button"
              onClick={() => onAcceptProposal?.(field.key)}
              className="rounded-full border border-ch-border-hover px-[10px] py-[3px] text-[11px] font-semibold text-slate-300 transition-colors duration-180 ease-ch hover:border-slate-500"
            >
              Usar el suyo
            </button>
            <button
              type="button"
              onClick={() => onRejectProposal?.(field.key)}
              className="rounded-full px-[10px] py-[3px] text-[11px] font-medium text-slate-500 transition-colors duration-180 ease-ch hover:text-slate-300"
            >
              Descartar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
