import { useEffect, useRef, useState } from 'react';
import { listingToFields, type Listing, type MortgageField, type PinnedField } from '@chat/shared';

type Props = { onCancel: () => void } & (
  | { variant?: 'cronograma'; fields: MortgageField[]; onConfirm: (fields: MortgageField[]) => void }
  | { variant: 'anuncio'; listing: Listing; onConfirm: (fields: PinnedField[]) => void }
);

type AnyField = MortgageField | PinnedField;

const COPY = {
  cronograma: {
    ariaLabel: 'Revisar lo que leí del cronograma',
    heading: 'Esto leí de tu cronograma',
    warning:
      'Dale una mirada antes de fijarlo. Puede leer mal un dígito y verse igual de seguro, y estas cifras son la base de todo lo que calcule después.',
    firm: 'documento' as const,
  },
  anuncio: {
    ariaLabel: 'Revisar lo que leí del anuncio',
    heading: 'Leí el anuncio',
    warning: "Un 'desde' es el precio más bajo del modelo; el tuyo puede ser otro. Revísalo antes de fijar.",
    firm: 'anuncio' as const,
  },
};

function modelLabel(m: Listing['modelos'][number]): string {
  return [m.nombre, m.area ? `${m.area} m²` : undefined, m.precioDesde ? `desde S/ ${m.precioDesde}` : undefined]
    .filter(Boolean)
    .join(' · ');
}

/**
 * The read is shown before it pins. Its job is not ceremony: a digit read off a
 * photo can be wrong and still look confident, and it would land in the field
 * the whole analysis is built on. The anuncio variant adds the one thing a
 * listing needs that a schedule does not: which of the project's models the
 * user is actually looking at.
 */
export function ConfirmExtraction(props: Props) {
  const variant = props.variant ?? 'cronograma';
  const copy = COPY[variant];
  const listing = props.variant === 'anuncio' ? props.listing : null;
  const single = listing !== null && listing.modelos.length === 1;

  const [chosen, setChosen] = useState<number | null>(single ? 0 : null);
  const [draft, setDraft] = useState<AnyField[]>(() =>
    props.variant === 'anuncio'
      ? listingToFields(props.listing, single ? props.listing.modelos[0]! : null)
      : props.fields,
  );
  const dialogRef = useRef<HTMLDivElement>(null);
  const { onCancel } = props;

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

    // Land on the first control, not the confirm button — the point of this
    // dialog is reading (or choosing) before accepting.
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

  // A digit changed here is no longer what the page or the bank said — it is
  // what the person typed, so it must pin as 'user', matching the panel's
  // edit convention. The note stays: it describes the field's nature, not
  // the specific digit read, so it is still accurate after the correction.
  const edit = (key: string, value: string) =>
    setDraft((d) => d.map((f) => (f.key === key ? { ...f, value, provenance: 'user' } : f)));

  const choose = (i: number) => {
    if (!listing) return;
    setChosen(i);
    setDraft(listingToFields(listing, listing.modelos[i]!));
  };

  // Ubicación/Precio/Área always show for a listing, even before a model is
  // chosen, so the user sees what choosing will fill.
  const rows: AnyField[] =
    listing && chosen === null
      ? [
          ...draft,
          { key: 'precio', label: 'Precio', value: '', prefix: 'S/', suffix: undefined, provenance: 'anuncio', note: '' },
          { key: 'area', label: 'Área', value: '', prefix: undefined, suffix: 'm²', provenance: 'anuncio', note: '' },
        ]
      : draft;

  const canConfirm = variant === 'cronograma' || draft.some((f) => f.key === 'precio' && f.value.trim());

  const confirm = () => {
    if (props.variant === 'anuncio') props.onConfirm(draft as PinnedField[]);
    else props.onConfirm(draft as MortgageField[]);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-5">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={copy.ariaLabel}
        tabIndex={-1}
        className="ch-rise max-h-[85vh] w-full max-w-[440px] overflow-y-auto rounded-xl border border-ch-border bg-ch-panel p-5 outline-none"
      >
        <h2 className="font-jakarta text-[19px] font-extrabold tracking-[-.02em] text-white">{copy.heading}</h2>
        {listing && (
          <p className="mt-1 text-[13px] font-medium text-slate-200">
            {[listing.proyecto, listing.distrito, listing.constructora, listing.entrega ? `entrega ${listing.entrega}` : undefined]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
        <p className="mt-2 text-[12.5px] leading-[1.6] text-slate-400">{copy.warning}</p>

        {listing && !single && (
          <fieldset className="mt-4">
            <legend className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-500">
              ¿Cuál modelo estás viendo?
            </legend>
            <div className="mt-2 flex flex-col gap-[6px]">
              {listing.modelos.map((m, i) => {
                const label = modelLabel(m);
                return (
                  <label
                    key={`${m.nombre ?? 'modelo'}-${i}`}
                    className={`flex cursor-pointer items-center gap-[10px] rounded-[10px] border px-3 py-[9px] text-[13px] text-slate-200 ${
                      chosen === i ? 'border-ch-accent' : 'border-ch-border hover:border-ch-border-hover'
                    }`}
                  >
                    <input
                      type="radio"
                      name="modelo"
                      checked={chosen === i}
                      onChange={() => choose(i)}
                      aria-label={label}
                      className="accent-ch-accent"
                    />
                    <span className="tnum">{label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        <div className="mt-4 flex flex-col gap-[10px]">
          {rows.map((f) => {
            const dudoso = f.provenance !== copy.firm;
            return (
              <div
                key={f.key}
                className={`rounded-[10px] border px-3 py-[10px] ${dudoso ? 'border-ch-accent' : 'border-ch-border'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-500">{f.label}</span>
                  {dudoso && f.value && <span className="text-[10px] font-semibold text-ch-accent">revisa este</span>}
                </div>
                <div className="mt-[6px] flex items-baseline gap-[5px]">
                  {f.prefix && <span className="text-[14px] font-bold text-slate-500">{f.prefix}</span>}
                  <input
                    value={f.value}
                    onChange={(e) => edit(f.key, e.target.value)}
                    aria-label={f.label}
                    data-dudoso={dudoso}
                    disabled={listing !== null && chosen === null && f.key !== 'ubicacion'}
                    placeholder={listing && chosen === null && f.key !== 'ubicacion' ? 'elige un modelo' : undefined}
                    className="tnum min-w-0 flex-1 border-none bg-transparent p-0 font-jakarta text-[17px] font-bold tracking-[-.02em] text-white outline-none placeholder:text-slate-600 disabled:opacity-60"
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
            onClick={confirm}
            disabled={!canConfirm}
            className="h-[44px] flex-1 rounded-full bg-slate-50 text-[13.5px] font-semibold text-ch-bg transition-opacity duration-120 ease-ch hover:opacity-90 active:translate-y-px disabled:opacity-40"
          >
            Fijar estos datos
          </button>
        </div>
      </div>
    </div>
  );
}
