import { useEffect, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

/**
 * A collapsible section of the pinned panel: a header with the title, the row
 * count and a chevron, then whatever rows the parent puts inside. Renders
 * nothing at all when the count is zero — an empty "Hipoteca" header would
 * read as a field the user forgot.
 */
export function FieldGroup({
  title,
  count,
  collapseAbove = Infinity,
  divider = false,
  children,
}: {
  title: string;
  count: number;
  /** Past this many rows the group would bury the others, so it starts shut. */
  collapseAbove?: number;
  divider?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(count <= collapseAbove);
  // The initializer above only runs once at mount, when an upload's fields
  // have not arrived yet (0 <= n, so it opens) — this group is mounted
  // unconditionally by its parent, before there is anything to show. Recompute
  // the rule whenever the count actually changes, but only until the user has
  // touched the toggle by hand: after that, their choice stands.
  const [touchedByUser, setTouchedByUser] = useState(false);
  useEffect(() => {
    if (touchedByUser) return;
    setOpen(count <= collapseAbove);
  }, [count, collapseAbove, touchedByUser]);

  if (count === 0) return null;

  return (
    <div className={divider ? 'mt-2 border-t border-ch-border pt-2' : ''}>
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
          {title}
        </span>
        <span className="text-[11px] font-medium text-slate-400">{count}</span>
        <div className="flex-1" />
        <Icon
          name={open ? 'arrow-up-01' : 'arrow-down-01'}
          size={15}
          className="text-ch-border-hover"
        />
      </button>
      {open && children}
    </div>
  );
}
