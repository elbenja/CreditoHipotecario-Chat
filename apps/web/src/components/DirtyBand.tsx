import type { PinnedField } from '@chat/shared';
import { Icon } from './Icon';
import { t, useT } from '../i18n';

export function describeDirty(
  fields: Record<string, PinnedField>,
  dirtyKeys: string[],
): string {
  const copy = t();
  // Each name carries its article ("la tasa", "the rate").
  const names = dirtyKeys.filter((k) => fields[k]).map((k) => copy.panel.dirtyNames[k] ?? fields[k]!.label);
  if (names.length === 0) return '';
  return copy.panel.dirty(copy.list(names));
}

export function DirtyBand({
  fields,
  dirtyKeys,
  onRecalculate,
  busy = false,
}: {
  fields: Record<string, PinnedField>;
  dirtyKeys: string[];
  onRecalculate: () => void;
  busy?: boolean;
}) {
  const copy = useT();
  const message = describeDirty(fields, dirtyKeys);
  if (!message) return null;

  return (
    <div className="ch-line mb-3">
      {/* One of the four permitted resting uses of the accent. */}
      <div className="rounded-[10px] border border-ch-accent/[.22] bg-ch-accent/[.09] px-[14px] py-[13px]">
        <p className="text-[12px] font-medium leading-[1.5] text-ch-accent">{message}</p>
      </div>
      <button
        type="button"
        onClick={onRecalculate}
        disabled={busy}
        className="mt-[10px] flex h-10 w-full items-center justify-center gap-2 rounded-full bg-ch-accent text-[13px] font-semibold text-ch-bg transition-opacity duration-120 ease-ch hover:opacity-90 active:translate-y-px active:opacity-85 disabled:opacity-50"
      >
        <Icon name="refresh" size={15} />
        {copy.panel.recalculate}
      </button>
    </div>
  );
}
