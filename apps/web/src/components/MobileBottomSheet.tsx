import { useEffect, useRef, useState } from 'react';
import type { PinnedField, Scenario } from '@chat/shared';
import type { FieldChange } from '../state/chatReducer';
import { Icon } from './Icon';
import { PinnedPanel } from './PinnedPanel';

type MobileBottomSheetProps = {
  fields: PinnedField[];
  proposals?: Record<string, PinnedField>;
  savedScenarios?: Scenario[];
  dirtyKeys?: string[];
  changes?: FieldChange[];
  busy?: boolean;
  onEdit: (key: string, value: string) => void;
  onAcceptProposal?: (key: string) => void;
  onRejectProposal?: (key: string) => void;
  onDeleteScenario?: (id: string) => void;
  onRecalculate?: () => void;
  onRevertChange?: (key: string) => void;
  onDismissChanges?: () => void;
};

export function MobileBottomSheet({
  fields,
  proposals = {},
  savedScenarios = [],
  dirtyKeys = [],
  changes = [],
  busy = false,
  onEdit,
  onAcceptProposal,
  onRejectProposal,
  onDeleteScenario,
  onRecalculate,
  onRevertChange,
  onDismissChanges,
}: MobileBottomSheetProps) {
  const [open, setOpen] = useState(false);
  const summaryRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const wasOpen = useRef(false);
  const assumedCount = fields.filter((field) => field.provenance !== 'user').length;
  const savedCount = savedScenarios.length;
  const scenarioLabel = savedCount === 1 ? 'escenario guardado' : 'escenarios guardados';

  const close = () => setOpen(false);

  useEffect(() => {
    if (!open && wasOpen.current) summaryRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const desktopQuery = window.matchMedia('(min-width: 768px)');
    const closeOnDesktop = (event: MediaQueryListEvent | MediaQueryList) => {
      if (event.matches) setOpen(false);
    };

    if (typeof desktopQuery.addEventListener === 'function') {
      desktopQuery.addEventListener('change', closeOnDesktop);
      return () => desktopQuery.removeEventListener('change', closeOnDesktop);
    }

    desktopQuery.addListener(closeOnDesktop);
    return () => desktopQuery.removeListener(closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
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
    };
  }, [open]);

  const handlePointerDown = (event: React.PointerEvent) => {
    startY.current = event.clientY;
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    startY.current = event.touches[0]?.clientY ?? null;
  };

  const handleCollapsedPointerUp = (event: React.PointerEvent) => {
    if (startY.current !== null && startY.current - event.clientY > 48) setOpen(true);
    startY.current = null;
  };

  const handleCollapsedTouchEnd = (event: React.TouchEvent) => {
    const endY = event.changedTouches[0]?.clientY;
    if (startY.current !== null && endY !== undefined && startY.current - endY > 48) setOpen(true);
    startY.current = null;
  };

  const handleExpandedPointerUp = (event: React.PointerEvent) => {
    if (startY.current !== null && event.clientY - startY.current > 48) close();
    startY.current = null;
  };

  const handleExpandedTouchEnd = (event: React.TouchEvent) => {
    const endY = event.changedTouches[0]?.clientY;
    if (startY.current !== null && endY !== undefined && endY - startY.current > 48) close();
    startY.current = null;
  };

  return (
    <>
      <section
        aria-hidden={open}
        className={`mobile-safe-bottom relative z-30 min-h-[96px] w-full flex-none rounded-t-[16px] border-t border-[#1e293b] bg-[#0f172a] px-4 pt-3 transition-opacity duration-120 ease-ch md:hidden ${open ? 'pointer-events-none opacity-0' : ''}`}
      >
          <button
            ref={summaryRef}
            type="button"
            aria-label="Abrir datos de la operación"
            aria-expanded={open}
            tabIndex={open ? -1 : undefined}
            onClick={() => setOpen(true)}
            onPointerDown={handlePointerDown}
            onPointerUp={handleCollapsedPointerUp}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleCollapsedTouchEnd}
            className="flex min-h-[44px] w-full flex-col items-start gap-1 pr-24 text-left"
          >
            <span className="mx-auto mb-1 h-1 w-9 rounded-full bg-slate-500" aria-hidden="true" />
            <span className="text-[13px] font-semibold text-white">
              {fields.length} datos fijados
            </span>
            {' '}
            <span className="text-[11.5px] font-medium text-slate-400">
              {assumedCount} {assumedCount === 1 ? 'lo asumí yo' : 'los asumí yo'} · {savedCount}{' '}
              {scenarioLabel}
            </span>
          </button>
          <button
            type="button"
            tabIndex={open ? -1 : undefined}
            className="absolute right-4 top-[44px] h-9 rounded-full bg-slate-50 px-4 text-[12px] font-semibold text-ch-bg transition-opacity duration-120 ease-ch hover:opacity-90"
          >
            Guardar
          </button>
      </section>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Cerrar panel"
            className="absolute inset-0 h-full w-full bg-[rgba(2,6,23,.6)]"
            onClick={close}
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-label="Datos de la operación"
            aria-modal="true"
            tabIndex={-1}
            className="ch-sheet-enter absolute bottom-0 flex h-[88dvh] w-full flex-col overflow-hidden rounded-t-[16px] border-t border-[#334155] bg-[#0f172a] outline-none"
          >
            <div className="flex h-[50px] flex-none items-center justify-between px-5">
              <button
                ref={closeRef}
                type="button"
                aria-label="Cerrar datos de la operación"
                onClick={close}
                onPointerDown={handlePointerDown}
                onPointerUp={handleExpandedPointerUp}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleExpandedTouchEnd}
                className="mx-auto grid h-11 w-11 place-items-center rounded-full text-slate-400 transition-colors duration-120 ease-ch hover:bg-ch-card hover:text-white"
              >
                <span className="h-1 w-9 rounded-full bg-slate-500" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Cerrar panel"
                onClick={close}
                className="absolute right-3 top-2 grid h-11 w-11 place-items-center rounded-full text-slate-400 transition-colors duration-120 ease-ch hover:bg-ch-card hover:text-white"
              >
                <Icon name="cancel-01" size={18} />
              </button>
            </div>
            <PinnedPanel
              mode="mobile"
              fields={fields}
              proposals={proposals}
              savedScenarios={savedScenarios}
              dirtyKeys={dirtyKeys}
              changes={changes}
              busy={busy}
              onEdit={onEdit}
              onAcceptProposal={onAcceptProposal}
              onRejectProposal={onRejectProposal}
              onDeleteScenario={onDeleteScenario}
              onRecalculate={onRecalculate}
              onRevertChange={onRevertChange}
              onDismissChanges={onDismissChanges}
            />
          </div>
        </div>
      )}
    </>
  );
}
