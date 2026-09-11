import { useState } from 'react';
import type { MortgageField } from '@chat/shared';
import { PinnedFieldRow } from './PinnedField';
import { Icon } from './Icon';

/** Past this many rows the group would bury the property fields, so it starts shut. */
const COLLAPSE_ABOVE = 4;

export function MortgageGroup({
  fields,
  onEdit,
}: {
  fields: MortgageField[];
  onEdit: (key: string, value: string) => void;
}) {
  const [open, setOpen] = useState(fields.length <= COLLAPSE_ABOVE);
  if (fields.length === 0) return null;

  return (
    <div className="mt-2 border-t border-ch-border pt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-[9px] text-left"
      >
        <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-500">
          Tu hipoteca
        </span>
        <span className="text-[11px] font-medium text-slate-400">{fields.length}</span>
        <div className="flex-1" />
        <Icon
          name={open ? 'arrow-up-01' : 'arrow-down-01'}
          size={15}
          className="text-ch-border-hover"
        />
      </button>
      {open && fields.map((f) => (
        <PinnedFieldRow key={f.key} field={f} onChange={onEdit} />
      ))}
    </div>
  );
}
