import { useEffect, useRef, useState } from 'react';
import { AnalyzeSteps } from '../components/AnalyzeSteps';
import { AssistantAnswer } from '../components/AssistantAnswer';
import { Composer } from '../components/Composer';
import { MetricSkeleton } from '../components/MetricSkeleton';
import { PinnedPanel } from '../components/PinnedPanel';
import { Thinking } from '../components/Thinking';
import { UserBubble } from '../components/UserBubble';
import type { ChatState } from '../state/chatReducer';

export function Conversation({
  state,
  onSend,
  onEdit,
  onAcceptProposal,
  onRejectProposal,
}: {
  state: ChatState;
  onSend: (text: string) => void;
  onEdit: (key: string, value: string) => void;
  onAcceptProposal: (key: string) => void;
  onRejectProposal: (key: string) => void;
}) {
  const [value, setValue] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const busy = state.status !== 'idle' && state.status !== 'error';

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages.length, state.status]);

  const send = (text: string) => {
    if (!text.trim()) return;
    // 01: the input clears in the same frame the bubble appears.
    setValue('');
    onSend(text);
  };

  return (
    <div className="flex min-h-0 flex-1">
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
                    <AssistantAnswer envelope={m.envelope} onFollowUp={send} />
                  </div>
                );
              }
              return (
                <div key={m.id} className="ch-line flex flex-col gap-3">
                  <p className="text-[14.5px] leading-[1.6] text-slate-300">{m.prose}</p>
                  {m.candidates.length > 0 && (
                    <div className="rounded-[10px] border border-ch-border p-[14px] text-[12px] text-slate-400">
                      No pude fijar estos datos automáticamente esta vez.
                    </div>
                  )}
                </div>
              );
            })}

            {state.status === 'thinking' && <Thinking />}
            {state.status === 'analyzing' && <AnalyzeSteps steps={state.analyzeSteps} />}
            {state.status === 'streaming' && <MetricSkeleton />}
            {state.status === 'error' && (
              <p className="text-[13px] text-slate-400">{state.error}</p>
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
            />
          </div>
        </div>
      </div>

      <PinnedPanel
        fields={Object.values(state.fields)}
        proposals={state.proposals}
        onEdit={onEdit}
        onAcceptProposal={onAcceptProposal}
        onRejectProposal={onRejectProposal}
      />
    </div>
  );
}
