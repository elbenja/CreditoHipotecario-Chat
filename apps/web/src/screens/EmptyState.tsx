import { useState } from 'react';
import { Composer } from '../components/Composer';
import { ConfirmExtraction } from '../components/ConfirmExtraction';
import { DropZone } from '../components/DropZone';
import { EmptyPanel } from '../components/EmptyPanel';
import { Icon } from '../components/Icon';
import { MobileBottomSheet } from '../components/MobileBottomSheet';
import { Pill } from '../components/Pill';
import { PinnedPanel } from '../components/PinnedPanel';
import { UploadingRow } from '../components/UploadingRow';
import { attachSchedule } from '../pdf/attachSchedule';
import type { Action, ChatState } from '../state/chatReducer';

const SUGGESTIONS = [
  '¿A cuánto puedo alquilarlo?',
  '¿Es un buen negocio?',
  '¿Cuánto me presta el banco?',
  '¿Me conviene amortizar?',
];

export function EmptyState({
  onSubmit,
  state,
  dispatch,
}: {
  onSubmit: (text: string) => void;
  /** Owns the attach-a-cronograma flow, same as Conversation's: opening the
   *  app holding the schedule is the most natural entry point, so the
   *  control cannot wait for a first message. Optional so a caller that
   *  never attaches — a test, say — need not wire it, and the attach
   *  control simply stays off. */
  state: ChatState;
  dispatch?: (action: Action) => void;
}) {
  const [value, setValue] = useState('');
  const busy = state.status !== 'idle' && state.status !== 'error';

  const attach = (file: File) =>
    dispatch ? attachSchedule(file, dispatch, Object.values(state.fields)) : undefined;

  // A schedule confirmed before the first message pins into state, and the
  // placeholder panel would hide it: the moment there is anything pinned, the
  // real panel takes over on both breakpoints.
  const fields = Object.values(state.fields);
  const mortgage = Object.values(state.mortgage);
  const hasData = fields.length + mortgage.length > 0;
  const onEdit = (key: string, value: string) => dispatch?.({ type: 'editField', key, value });
  const onEditMortgage = (key: string, value: string) =>
    dispatch?.({ type: 'editMortgageField', key, value });

  const progress = state.attachment && (
    <div className="mt-3">
      <UploadingRow attachment={state.attachment} status={state.status} steps={state.analyzeSteps} />
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      {/* Everything but the panel takes a dropped schedule (card 10). */}
      <DropZone onDrop={attach} disabled={busy || !dispatch} className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden px-5 pt-3 md:hidden">
        <div className="mx-auto w-full max-w-transcript">
          <h1 className="font-jakarta text-[27px] font-extrabold leading-[1.18] tracking-[-.03em] text-white">
            ¿Qué depa estás evaluando?
          </h1>
          <p className="mt-[10px] text-[13.5px] leading-[1.6] text-slate-400">
            Cuéntamelo en tus palabras. Voy fijando los datos abajo y los puedes corregir cuando
            quieras.
          </p>

          <div className="mb-3 mt-7 text-[10px] font-semibold uppercase leading-none tracking-[.1em] text-slate-500">
            O empieza por una pregunta
          </div>
          <div
            role="region"
            aria-label="Preguntas sugeridas para móvil"
            className="flex flex-col gap-2"
          >
            {SUGGESTIONS.slice(0, 3).map((s) => (
              <Pill
                key={s}
                onClick={() => onSubmit(s)}
                className="min-h-[45px] w-full !rounded-xl border-ch-border-hover px-[15px] py-3 text-left text-[13.5px]"
              >
                {s}
              </Pill>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-none px-5 pt-[14px] md:hidden">
        <Composer
          value={value}
          onChange={setValue}
          onSubmit={() => onSubmit(value)}
          placeholder="Describe tu depa…"
          disabled={busy}
          onAttach={dispatch ? attach : undefined}
        />
        {progress}
        {state.status === 'error' && state.error && (
          <p className="mt-2 text-[12px] font-medium text-[#f59e0b]">{state.error.message}</p>
        )}
      </div>

      {hasData ? (
        <MobileBottomSheet
          fields={fields}
          mortgage={mortgage}
          busy={busy}
          onEdit={onEdit}
          onEditMortgage={onEditMortgage}
        />
      ) : (
        <div className="mobile-safe-bottom mt-3 flex min-h-[62px] flex-none items-center gap-3 border-t border-ch-border px-5 text-[12.5px] font-medium text-slate-400 md:hidden">
          <span className="flex-1">Ningún dato fijado todavía</span>
          <Icon name="arrow-up-01" size={16} className="text-ch-border-hover" />
        </div>
      )}

      <div className="hidden flex-1 flex-col justify-center px-14 md:flex">
        <div className="mx-auto w-full max-w-transcript">
          <h1 className="font-jakarta text-[32px] font-extrabold leading-[1.2] tracking-[-.03em] text-white">
            ¿Qué depa estás evaluando?
          </h1>
          <p className="mt-3 text-[14.5px] leading-[1.6] text-slate-400">
            Cuéntamelo en tus palabras. Voy fijando los datos a la derecha y los puedes corregir
            cuando quieras.
          </p>

          <div className="mt-[26px]">
            <Composer
              variant="empty"
              value={value}
              onChange={setValue}
              onSubmit={() => onSubmit(value)}
              placeholder="Depa de 250 mil en Pueblo Libre, 40 m², tasa 8%…"
              disabled={busy}
              onAttach={dispatch ? attach : undefined}
            />
            {progress}
            {state.status === 'error' && state.error && (
              <p className="mt-2 text-[12px] font-medium text-[#f59e0b]">{state.error.message}</p>
            )}
          </div>

          <div className="mb-[14px] mt-[30px] text-[10px] font-semibold uppercase tracking-[.1em] text-slate-500">
            O empieza por una pregunta
          </div>
          <div className="flex flex-wrap gap-[9px]">
            {SUGGESTIONS.map((s) => (
              <Pill key={s} onClick={() => onSubmit(s)}>
                {s}
              </Pill>
            ))}
          </div>
        </div>
      </div>

      </DropZone>

      {hasData ? (
        <PinnedPanel
          fields={fields}
          mortgage={mortgage}
          busy={busy}
          onEdit={onEdit}
          onEditMortgage={onEditMortgage}
        />
      ) : (
        <EmptyPanel />
      )}

      {dispatch && state.pendingExtraction && (
        <ConfirmExtraction
          fields={state.pendingExtraction}
          onConfirm={(fields) => dispatch({ type: 'confirmExtraction', fields })}
          onCancel={() => dispatch({ type: 'cancelExtraction' })}
        />
      )}
    </div>
  );
}
