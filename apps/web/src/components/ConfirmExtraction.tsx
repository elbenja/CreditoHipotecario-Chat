import { useEffect, useRef, useState } from 'react';
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
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  // Mounted only while open (no `open` prop — the parent controls mounting), so
  // "on close" here means unmount: grab the pre-open focus now and hand it back
  // in the cleanup, trap Tab in a cycle while mounted, and lock body scroll —
  // same idiom as MobileBottomSheet's dialog.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const getFocusable = () =>
      dialogRef.current
        ? Array.from(
            dialogRef.current.querySelectorAll<HTMLElement>(
              'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
            ),
          )
        : [];

    // Land on the first field, not the confirm button — the point of this
    // dialog is reading the figures before accepting them.
    (getFocusable()[0] ?? dialogRef.current)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  const edit = (key: string, value: string) =>
    setDraft((d) => d.map((f) => (f.key === key ? { ...f, value } : f)));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-5">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Revisar lo que leí del cronograma"
        tabIndex={-1}
        className="ch-rise max-h-[85vh] w-full max-w-[440px] overflow-y-auto rounded-xl border border-ch-border bg-ch-panel p-5 outline-none"
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
