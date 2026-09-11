import { useEffect, useState } from 'react';
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
  onEdit?: (key: string, value: string) => void;
}) {
  const [open, setOpen] = useState(fields.length <= COLLAPSE_ABOVE);
  // The initializer above only runs once at mount, when an upload's fields
  // have not arrived yet (0 <= 4, so it opens) — this group is mounted
  // unconditionally by its parent, before there is anything to show. Recompute
  // the rule whenever the field count actually changes, but only until the
  // user has touched the toggle by hand: after that, their choice stands.
  const [touchedByUser, setTouchedByUser] = useState(false);
  useEffect(() => {
    if (touchedByUser) return;
    setOpen(fields.length <= COLLAPSE_ABOVE);
  }, [fields.length, touchedByUser]);

  if (fields.length === 0) return null;

  return (
    <div className="mt-2 border-t border-ch-border pt-2">
      <button
        type="button"
        onClick={() => {
          setTouchedByUser(true);
          setOpen((o) => !o);
        }}
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
        <PinnedFieldRow key={f.key} field={f} onChange={(key, value) => onEdit?.(key, value)} />
      ))}
    </div>
  );
}
