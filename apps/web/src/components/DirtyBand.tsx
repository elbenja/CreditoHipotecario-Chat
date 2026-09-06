import type { PinnedField } from '@chat/shared';
import { Icon } from './Icon';

/** Spanish articles for the field labels the panel can show. */
const ARTICLE: Record<string, string> = {
  ubicacion: 'la ubicación',
  precio: 'el precio',
  area: 'el área',
  tasa: 'la tasa',
  inicial: 'la cuota inicial',
  plazo: 'el plazo',
  alquiler: 'el alquiler',
};

export function describeDirty(
  fields: Record<string, PinnedField>,
  dirtyKeys: string[],
): string {
  const names = dirtyKeys.filter((k) => fields[k]).map((k) => ARTICLE[k] ?? fields[k]!.label);
  if (names.length === 0) return '';

  const joined =
    names.length === 1
      ? names[0]!
      : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]!}`;

  return `Cambiaste ${joined}. Los números de arriba son de antes.`;
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
  const message = describeDirty(fields, dirtyKeys);
  if (!message) return null;

  return (
    <div className="ch-line mb-3">
      {/* One of the four permitted resting uses of the accent. */}
      <div className="rounded-[10px] border border-[rgba(244,188,68,.22)] bg-[rgba(244,188,68,.09)] px-[14px] py-[13px]">
        <p className="text-[12px] font-medium leading-[1.5] text-ch-accent">{message}</p>
      </div>
      <button
        type="button"
        onClick={onRecalculate}
        disabled={busy}
        className="mt-[10px] flex h-10 w-full items-center justify-center gap-2 rounded-full bg-ch-accent text-[13px] font-semibold text-ch-bg transition-opacity duration-120 ease-ch hover:opacity-90 active:translate-y-px active:opacity-85 disabled:opacity-50"
      >
        <Icon name="refresh" size={15} />
        Recalcular
      </button>
    </div>
  );
}
