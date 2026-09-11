import type { MortgageField, PinnedField } from '@chat/shared';
import { Icon } from './Icon';

export function PinnedFieldRow({
  field,
  proposal,
  change,
  onChange,
  onAcceptProposal,
  onRejectProposal,
}: {
  field: PinnedField | MortgageField;
  proposal?: PinnedField;
  /** Card 13: the last schedule touched this row. `null` means it was new;
   *  a string is the value it replaced, shown struck through beneath. */
  change?: string | null;
  onChange: (key: string, value: string) => void;
  onAcceptProposal?: (key: string) => void;
  onRejectProposal?: (key: string) => void;
}) {
  // A value read off the bank's own schedule is firmer than anything the user
  // recalled, so it gets its own mark rather than being folded into either
  // existing state.
  const fromDocument = field.provenance === 'documento';
  // Provenance is the whole point: a value the user did not state must never
  // read as fact. Anything that is not 'user' (and not already covered above)
  // gets the accent dot — the live model also returns 'market', and testing
  // `=== 'assumed'` would render a market estimate as "Lo dijiste tú".
  const notFromUser = field.provenance !== 'user' && !fromDocument;

  const dotClass = fromDocument ? 'bg-emerald-400' : notFromUser ? 'bg-ch-accent' : 'bg-slate-400';
  const dotTitle = fromDocument ? 'Lo leí del banco' : notFromUser ? 'Lo asumí yo' : 'Lo dijiste tú';

  return (
    <div
      className={`rounded-[10px] border border-transparent px-3 py-[11px] transition-colors duration-180 ease-ch hover:border-ch-border ${
        change !== undefined ? 'ch-wash' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[.1em] text-slate-500 md:text-[10px]">
          {field.label}
        </span>
        <span
          className={`h-[6px] w-[6px] rounded-full ${dotClass}`}
          title={dotTitle}
        />
        <div className="flex-1" />
        <Icon name="edit-01" size={13} className="text-slate-500" />
      </div>

      <div className="mt-[7px] flex items-baseline gap-[5px]">
        {field.prefix && (
          <span className="font-jakarta text-[15px] font-bold text-slate-500 md:text-[14px]">{field.prefix}</span>
        )}
        <input
          value={field.value}
          onChange={(e) => onChange(field.key, e.target.value)}
          className="tnum min-w-0 flex-1 border-none bg-transparent p-0 font-jakarta text-[18px] font-bold tracking-[-.02em] text-white outline-none md:text-[17px]"
          aria-label={field.label}
        />
        {field.suffix && <span className="text-[15px] text-slate-400 md:text-[14px]">{field.suffix}</span>}
      </div>

      {field.note && (
        <p className="mt-[5px] text-[11.5px] font-medium leading-[1.45] text-slate-400 md:text-[11px]">{field.note}</p>
      )}

      {/* Seeing the change is worth more than knowing there was one. */}
      {typeof change === 'string' && (
        <p className="mt-[5px] text-[11px] text-slate-400">
          antes <s>{change}{field.suffix ? ` ${field.suffix}` : ''}</s> · leído del PDF
        </p>
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
