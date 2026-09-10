import type { FieldKey, PinnedField } from '@chat/shared';
import { FIELD_LABELS, getMissingFields } from '../state/guidance';
import { Pill } from './Pill';

export function FieldSuggestions({ fields = {}, onAsk, disabled = false, selected = null }: {
  fields?: Record<string, PinnedField>;
  onAsk: (key: FieldKey) => void;
  disabled?: boolean;
  selected?: FieldKey | null;
}) {
  const missing = getMissingFields(fields);
  if (!missing.length) return null;
  return (
    <div>
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
        {Object.keys(fields).length ? 'Puedes agregar más datos' : 'Puedes empezar por lo que sabes'}
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Datos de la propiedad">
        {missing.map((key) => (
          <Pill key={key} onClick={() => onAsk(key)} disabled={disabled || selected === key} className="min-h-[44px]">
            {FIELD_LABELS[key]}
          </Pill>
        ))}
      </div>
    </div>
  );
}
