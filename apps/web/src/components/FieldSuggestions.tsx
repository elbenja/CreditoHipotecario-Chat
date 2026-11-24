import type { FieldKey, PinnedField } from '@chat/shared';
import { getMissingFields } from '../state/guidance';
import { useT } from '../i18n';
import { Pill } from './Pill';

export function FieldSuggestions({ fields = {}, onAsk, disabled = false, selected = null }: {
  fields?: Record<string, PinnedField>;
  onAsk: (key: FieldKey) => void;
  disabled?: boolean;
  selected?: FieldKey | null;
}) {
  const copy = useT();
  const missing = getMissingFields(fields);
  if (!missing.length) return null;
  return (
    <div>
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
        {Object.keys(fields).length ? copy.empty.addMore : copy.empty.startWith}
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={copy.empty.propertyData}>
        {missing.map((key) => (
          <Pill key={key} onClick={() => onAsk(key)} disabled={disabled || selected === key} className="min-h-[44px]">
            {copy.fieldLabels[key]}
          </Pill>
        ))}
      </div>
    </div>
  );
}
