import type { FieldChange } from '../state/chatReducer';
import { Icon } from './Icon';

export function ChangesStrip({
  changes,
  onRevert,
  onDismiss,
}: {
  changes: FieldChange[];
  onRevert: (key: string) => void;
  onDismiss: () => void;
}) {
  if (changes.length === 0) return null;

  return (
    /* Neutral, not accent: the accent is spent on its four resting uses. */
    <div className="ch-line mx-3 mb-2 rounded-[10px] border border-ch-border p-3">
      <div className="flex items-center gap-2">
        <Icon name="information-circle" size={14} className="text-slate-400" />
        <span className="flex-1 text-[11.5px] font-medium text-slate-400">
          {changes.length === 1 ? 'Actualicé un dato' : `Actualicé ${changes.length} datos`}
        </span>
        <button
          type="button"
          onClick={onDismiss}
          className="text-[11px] font-medium text-slate-500 transition-colors duration-120 ease-ch hover:text-slate-300"
        >
          Entendido
        </button>
      </div>

      <ul className="mt-2 flex flex-col gap-[6px]">
        {changes.map((c) => (
          <li key={c.key} className="flex items-center gap-2 text-[11.5px]">
            <span className="text-slate-500">{c.label}</span>
            <span className="tnum text-slate-500 line-through">{c.from}</span>
            <Icon name="arrow-right-01" size={11} className="text-slate-600" />
            <span className="tnum font-semibold text-white">{c.to}</span>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => onRevert(c.key)}
              className="rounded-full border border-ch-border-hover px-[9px] py-[2px] text-[11px] font-medium text-slate-300 transition-colors duration-120 ease-ch hover:border-slate-500"
            >
              Deshacer
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
