import { useState } from 'react';
import type { FieldKey } from '@chat/shared';
import { Composer } from '../components/Composer';
import { ConfirmExtraction } from '../components/ConfirmExtraction';
import { DropZone } from '../components/DropZone';
import { EmptyPanel } from '../components/EmptyPanel';
import { FieldSuggestions } from '../components/FieldSuggestions';
import { Icon } from '../components/Icon';
import { MobileBottomSheet } from '../components/MobileBottomSheet';
import { PinnedPanel } from '../components/PinnedPanel';
import { UploadingRow } from '../components/UploadingRow';
import { attachSchedule } from '../pdf/attachSchedule';
import type { Action, ChatState } from '../state/chatReducer';

export function EmptyState({
  onSubmit,
  onAskField,
  state,
  dispatch,
}: {
  onSubmit: (text: string) => void;
  onAskField?: (key: FieldKey) => void;
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
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-6 md:px-14">
            <div className="mx-auto my-auto w-full max-w-transcript">
              <h1 className="font-jakarta text-[27px] font-extrabold leading-[1.2] tracking-[-.03em] text-white md:text-[32px]">
                Cuéntame del depa y su hipoteca
              </h1>
              <p className="mt-3 text-[13.5px] leading-[1.6] text-slate-400 md:text-[14.5px]">
                No necesitas tener todos los datos. Los vamos ordenando mientras conversas.
              </p>
              <div className="my-6 border-l-2 border-ch-border-hover pl-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">Por ejemplo</p>
                <p className="text-[13.5px] leading-[1.7] text-slate-300 md:text-[14.5px]">
                  “Estoy viendo un depa en Pueblo Libre de S/ 300,000 y 70 m². Tengo S/ 60,000 de inicial y me ofrecen una tasa de 8%”.
                </p>
              </div>
              <div className="mb-7 hidden md:block">
                <Composer
                  variant="empty"
                  value={value}
                  onChange={setValue}
                  onSubmit={() => onSubmit(value)}
                  placeholder="Cuéntame lo que sabes del depa…"
                  disabled={busy}
                  onAttach={dispatch ? attach : undefined}
                />
                {progress}
                {state.status === 'error' && state.error && (
                  <p className="mt-2 text-[12px] font-medium text-[#f59e0b]">{state.error.message}</p>
                )}
              </div>
              {onAskField && (
                <FieldSuggestions fields={state.fields} onAsk={onAskField} disabled={busy} />
              )}
            </div>
          </div>

          <div className="flex-none px-5 pt-3 md:hidden">
            <Composer
              value={value}
              onChange={setValue}
              onSubmit={() => onSubmit(value)}
              placeholder="Cuéntame lo que sabes del depa…"
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
              mortgageChanges={state.mortgageChanges}
              mortgageRevision={state.mortgageRevision}
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
        </div>
      </DropZone>

      {hasData ? (
        <PinnedPanel
          fields={fields}
          mortgage={mortgage}
          mortgageChanges={state.mortgageChanges}
          mortgageRevision={state.mortgageRevision}
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

      {dispatch && state.pendingListing && (
        <ConfirmExtraction
          variant="anuncio"
          listing={state.pendingListing}
          onConfirm={(fields) => dispatch({ type: 'confirmListing', fields })}
          onCancel={() => dispatch({ type: 'cancelListing' })}
        />
      )}
    </div>
  );
}
