import { useEffect, useState } from 'react';
import type { MortgageField } from '@chat/shared';

/**
 * The read is shown before it pins. Its job is not ceremony: a digit read off a
 * photo can be wrong and still look confident, and it would land in the field
 * the whole analysis is built on.
 */
export function ConfirmExtraction({
  fields,
  onConfirm,
  onCancel,
}: {
  fields: MortgageField[];
  onConfirm: (fields: MortgageField[]) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(fields);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const edit = (key: string, value: string) =>
    setDraft((d) => d.map((f) => (f.key === key ? { ...f, value } : f)));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Revisar lo que leí del cronograma"
        className="ch-rise max-h-[85vh] w-full max-w-[440px] overflow-y-auto rounded-xl border border-ch-border bg-ch-panel p-5"
      >
        <h2 className="font-jakarta text-[19px] font-extrabold tracking-[-.02em] text-white">
          Esto leí de tu cronograma
        </h2>
        <p className="mt-2 text-[12.5px] leading-[1.6] text-slate-400">
          Dale una mirada antes de fijarlo. Puede leer mal un dígito y verse igual
          de seguro, y estas cifras son la base de todo lo que calcule después.
        </p>

        <div className="mt-4 flex flex-col gap-[10px]">
          {draft.map((f) => {
            const dudoso = f.provenance !== 'documento';
            return (
              <div
                key={f.key}
                className={`rounded-[10px] border px-3 py-[10px] ${
                  dudoso ? 'border-ch-accent' : 'border-ch-border'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-500">
                    {f.label}
                  </span>
                  {dudoso && (
                    <span className="text-[10px] font-semibold text-ch-accent">revisa este</span>
                  )}
                </div>
                <div className="mt-[6px] flex items-baseline gap-[5px]">
                  {f.prefix && <span className="text-[14px] font-bold text-slate-500">{f.prefix}</span>}
                  <input
                    value={f.value}
                    onChange={(e) => edit(f.key, e.target.value)}
                    aria-label={f.label}
                    data-dudoso={dudoso}
                    className="tnum min-w-0 flex-1 border-none bg-transparent p-0 font-jakarta text-[17px] font-bold tracking-[-.02em] text-white outline-none"
                  />
                  {f.suffix && <span className="text-[14px] text-slate-400">{f.suffix}</span>}
                </div>
                {f.note && <p className="mt-[6px] text-[11.5px] text-slate-400">{f.note}</p>}
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex gap-[10px]">
          <button
            type="button"
            onClick={onCancel}
            className="h-[44px] flex-1 rounded-full border border-ch-border-hover text-[13.5px] font-semibold text-slate-300 transition-colors duration-180 ease-ch hover:border-slate-500"
          >
            Descartar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(draft)}
            className="h-[44px] flex-1 rounded-full bg-slate-50 text-[13.5px] font-semibold text-ch-bg transition-opacity duration-120 ease-ch hover:opacity-90 active:translate-y-px"
          >
            Fijar estos datos
          </button>
        </div>
      </div>
    </div>
  );
}
