import { useEffect, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

/**
 * A collapsible section of the pinned panel: a header with the title, the row
 * count and a chevron, then whatever rows the parent puts inside. Renders
 * nothing at all when the count is zero — an empty "Hipoteca" header would
 * read as a field the user forgot. Starts open; only the user closes it.
 */
export function FieldGroup({
  title,
  count,
  notice,
  divider = false,
  children,
}: {
  title: string;
  count: number;
  /** Card 12: a change that landed from a schedule. While the group is shut
   *  and this revision has not been seen, a pill says how many rows the PDF
   *  pinned; opening the group clears it. Nothing auto-expands. */
  notice?: { count: number; revision: number };
  divider?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const [seenRevision, setSeenRevision] = useState(notice?.revision ?? 0);
  // A change that lands while the group is open is seen as it happens — the
  // rows themselves show it — so the pill is only owed when it was shut.
  useEffect(() => {
    if (open && notice) setSeenRevision(notice.revision);
  }, [open, notice]);

  if (count === 0) return null;

  const pending = !open && notice !== undefined && notice.revision > seenRevision;

  return (
    <div className={divider ? 'mt-2 border-t border-ch-border pt-2' : ''}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-[9px] text-left"
      >
        <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-500">
          {title}
        </span>
        <CrossfadeCount value={count} />
        {pending && (
          <span className="ch-badge inline-flex items-center gap-[5px] rounded-full bg-[rgba(244,188,68,.15)] px-[9px] py-[3px] text-[10.5px] font-semibold text-ch-accent">
            <span className="h-[5px] w-[5px] rounded-full bg-ch-accent" />
            {notice.count} del PDF
          </span>
        )}
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

/**
 * Card 12: the count crossfades from the old number to the new one in 180ms.
 * Never counts up — a figure that ticks while you read it cannot be trusted.
 */
function CrossfadeCount({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const [leaving, setLeaving] = useState<number | null>(null);
  useEffect(() => {
    if (value === shown) return;
    setLeaving(shown);
    setShown(value);
  }, [value, shown]);

  return (
    <span className="tnum relative inline-block h-[14px] min-w-[10px] text-[11px] font-medium leading-[14px] text-slate-400">
      {leaving !== null && (
        <span
          aria-hidden="true"
          className="ch-count-out absolute inset-0"
          onAnimationEnd={() => setLeaving(null)}
        >
          {leaving}
        </span>
      )}
      <span key={shown} className={leaving !== null ? 'ch-count-in' : ''}>
        {shown}
      </span>
    </span>
  );
}
