import { useEffect, useRef, useState } from 'react';
import { AnalyzeSteps } from '../components/AnalyzeSteps';
import { AssistantAnswer } from '../components/AssistantAnswer';
import { Composer } from '../components/Composer';
import { ErrorNotice } from '../components/ErrorNotice';
import { Icon } from '../components/Icon';
import { MetricSkeleton } from '../components/MetricSkeleton';
import { MobileBottomSheet } from '../components/MobileBottomSheet';
import { OfflineBanner } from '../components/OfflineBanner';
import { OutOfScopeAnswer } from '../components/OutOfScopeAnswer';
import { Pill } from '../components/Pill';
import { PinnedPanel } from '../components/PinnedPanel';
import { Thinking } from '../components/Thinking';
import { TruncatedNotice } from '../components/TruncatedNotice';
import { UndoBar } from '../components/UndoBar';
import { UserBubble } from '../components/UserBubble';
import { selectDirtyKeys, type ChatState } from '../state/chatReducer';

export function Conversation({
  state,
  onSend,
  onEdit,
  onAcceptProposal,
  onRejectProposal,
  onPinCandidate,
  savedIds,
  onSaveScenario,
  onDeleteScenario,
  onUndoDelete,
  onRecalculate,
  onRevertChange,
  onDismissChanges,
  onRetry,
  onEditQuestion,
  onContinue,
  onShorten,
  composerSeed,
}: {
  state: ChatState;
  onSend: (text: string) => void;
  onEdit: (key: string, value: string) => void;
  onAcceptProposal: (key: string) => void;
  onRejectProposal: (key: string) => void;
  onPinCandidate: (key: string, label: string, value: string) => void;
  savedIds: string[];
  onSaveScenario: (id: string) => void;
  onDeleteScenario: (id: string) => void;
  onUndoDelete: () => void;
  onRecalculate: () => void;
  onRevertChange: (key: string) => void;
  onDismissChanges: () => void;
  onRetry: () => void;
  onEditQuestion: () => void;
  onContinue: () => void;
  onShorten: () => void;
  composerSeed: { text: string; n: number } | null;
}) {
  const [value, setValue] = useState('');
  const [showUndo, setShowUndo] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const busy = state.status !== 'idle' && state.status !== 'error';

  useEffect(() => {
    if (composerSeed) setValue(composerSeed.text);
  }, [composerSeed]);

  const deleteScenario = (id: string) => {
    onDeleteScenario(id);
    setShowUndo(true);
  };

  const undo = () => {
    setShowUndo(false);
    onUndoDelete();
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages.length, state.status]);

  const send = (text: string) => {
    if (!text.trim()) return;
    // 01: the input clears in the same frame the bubble appears.
    setValue('');
    onSend(text);
  };

  let suggestions: string[] = [];
  for (let i = state.messages.length - 1; i >= 0; i -= 1) {
    const m = state.messages[i]!;
    if (m.role === 'assistant') {
      suggestions = m.envelope.followUps;
      break;
    }
  }

  return (
    <div className="relative flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        {state.offline && <OfflineBanner />}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-2 md:px-14 md:pt-8">
          <div className="mx-auto flex w-full max-w-transcript flex-col gap-[18px] md:gap-[26px]">
            {state.messages.map((m) => {
              if (m.role === 'user') {
                return (
                  <div key={m.id} className="ch-enter flex flex-col">
                    <UserBubble content={m.content} />
                  </div>
                );
              }
              if (m.role === 'assistant') {
                return (
                  <div key={m.id} className="ch-line">
                    {m.outOfScope ? (
                      <OutOfScopeAnswer envelope={m.envelope} onFollowUp={send} />
                    ) : (
                      <AssistantAnswer
                        envelope={m.envelope}
                        onFollowUp={send}
                        onSaveScenario={onSaveScenario}
                        savedIds={savedIds}
                        disabled={busy}
                      />
                    )}
                    {m.truncated && <TruncatedNotice onContinue={onContinue} onShorten={onShorten} />}
                  </div>
                );
              }
              return (
                <div key={m.id} className="ch-line flex flex-col gap-3">
                  <p className="break-words text-[13.5px] leading-[1.6] text-slate-300 md:text-[14.5px]">{m.prose}</p>
                  {m.candidates.length > 0 && (
                    <div className="rounded-[10px] border border-ch-border p-[14px]">
                      <p className="text-[12px] font-medium text-slate-400">
                        No pude fijar estos datos solo. ¿Los agrego?
                      </p>
                      <div className="mt-[10px] flex flex-wrap gap-2">
                        {m.candidates.map((c) => (
                          <button
                            key={`${c.key}-${c.value}`}
                            type="button"
                            onClick={() => onPinCandidate(c.key, c.label, c.value)}
                            className="flex items-center gap-[6px] rounded-full border border-ch-border-hover px-[11px] py-[6px] text-[11.5px] font-medium text-slate-300 transition-colors duration-180 ease-ch hover:border-slate-500"
                          >
                            <Icon name="plus-sign" size={12} />
                            {c.label}: {c.value}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {m.truncated && <TruncatedNotice onContinue={onContinue} onShorten={onShorten} />}
                </div>
              );
            })}

            {state.status === 'thinking' && <Thinking />}
            {state.status === 'analyzing' && <AnalyzeSteps steps={state.analyzeSteps} />}
            {state.status === 'streaming' && <MetricSkeleton />}
            {state.status === 'error' && state.error && (
              <ErrorNotice error={state.error} onRetry={onRetry} onEdit={onEditQuestion} />
            )}

            {state.queued && (
              <div className="ch-enter flex flex-col gap-1">
                {/* Pending, not lost — the same bubble, just not sent yet. */}
                <div className="self-end opacity-45">
                  <UserBubble content={state.queued} />
                </div>
                <span className="self-end text-[11px] font-medium text-slate-400">
                  Se enviará al reconectar
                </span>
              </div>
            )}

            <div ref={endRef} />
          </div>
        </div>

        <div className="flex-none px-5 pb-0 pt-3 md:px-14 md:pb-6 md:pt-5">
          <div className="mx-auto w-full max-w-transcript">
            {suggestions.length > 0 && (
              <div className="ch-scrollbar-none -mr-5 mb-3 flex min-w-0 flex-nowrap gap-[9px] overflow-x-auto pr-10 md:mr-0 md:hidden md:pr-0">
                {suggestions.slice(0, 2).map((suggestion) => (
                  <Pill key={suggestion} onClick={() => send(suggestion)} className="flex-none text-[12.5px]">
                    {suggestion}
                  </Pill>
                ))}
              </div>
            )}
            <Composer
              value={value}
              onChange={setValue}
              onSubmit={() => send(value)}
              placeholder={state.offline ? 'Sin conexión…' : 'Pregunta lo que quieras…'}
              // Offline still lets the user type and send once — that's the
              // only way a message reaches the queue. Once something is
              // queued (the single pending slot) the composer locks until
              // reconnect flushes it.
              disabled={busy || (state.offline && state.queued !== null)}
              suggestions={suggestions}
              onSuggestion={send}
            />
          </div>
        </div>

        <MobileBottomSheet
          fields={Object.values(state.fields)}
          proposals={state.proposals}
          changes={state.changes}
          savedScenarios={state.savedScenarios}
          dirtyKeys={selectDirtyKeys(state)}
          busy={busy}
          onEdit={onEdit}
          onAcceptProposal={onAcceptProposal}
          onRejectProposal={onRejectProposal}
          onDeleteScenario={deleteScenario}
          onRecalculate={onRecalculate}
          onRevertChange={onRevertChange}
          onDismissChanges={onDismissChanges}
        />
      </div>

      <PinnedPanel
        fields={Object.values(state.fields)}
        proposals={state.proposals}
        changes={state.changes}
        savedScenarios={state.savedScenarios}
        dirtyKeys={selectDirtyKeys(state)}
        busy={busy}
        onEdit={onEdit}
        onAcceptProposal={onAcceptProposal}
        onRejectProposal={onRejectProposal}
        onDeleteScenario={deleteScenario}
        onRecalculate={onRecalculate}
        onRevertChange={onRevertChange}
        onDismissChanges={onDismissChanges}
      />

      <UndoBar visible={showUndo} onUndo={undo} onExpire={() => setShowUndo(false)} />
    </div>
  );
}
