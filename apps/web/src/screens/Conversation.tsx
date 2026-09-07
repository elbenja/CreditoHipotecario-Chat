import { useEffect, useRef, useState } from 'react';
import { AnalyzeSteps } from '../components/AnalyzeSteps';
import { AssistantAnswer } from '../components/AssistantAnswer';
import { Composer } from '../components/Composer';
import { ErrorNotice } from '../components/ErrorNotice';
import { MetricSkeleton } from '../components/MetricSkeleton';
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
        <div className="min-h-0 flex-1 overflow-y-auto px-14 pt-8">
          <div className="mx-auto flex w-full max-w-transcript flex-col gap-[26px]">
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
                    <AssistantAnswer
                      envelope={m.envelope}
                      onFollowUp={send}
                      onSaveScenario={onSaveScenario}
                      savedIds={savedIds}
                      disabled={busy}
                    />
                    {m.truncated && <TruncatedNotice onContinue={onContinue} onShorten={onShorten} />}
                  </div>
                );
              }
              return (
                <div key={m.id} className="ch-line flex flex-col gap-3">
                  <p className="break-words text-[14.5px] leading-[1.6] text-slate-300">{m.prose}</p>
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
                            className="rounded-full border border-ch-border-hover px-[11px] py-[6px] text-[11.5px] font-medium text-slate-300 transition-colors duration-180 ease-ch hover:border-slate-500"
                          >
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

            <div ref={endRef} />
          </div>
        </div>

        <div className="flex-none px-14 pb-6 pt-5">
          <div className="mx-auto w-full max-w-transcript">
            <Composer
              value={value}
              onChange={setValue}
              onSubmit={() => send(value)}
              placeholder="Pregunta lo que quieras…"
              disabled={busy}
              suggestions={suggestions}
              onSuggestion={send}
            />
          </div>
        </div>
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
