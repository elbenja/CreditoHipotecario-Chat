import { useCallback, useEffect, useReducer } from 'react';
import { streamChat } from './api/streamChat';
import { TopNav } from './components/TopNav';
import { Conversation } from './screens/Conversation';
import { EmptyState } from './screens/EmptyState';
import { chatReducer, type Message } from './state/chatReducer';
import { loadState, saveState } from './state/persistence';
import type { PinnedField, Scenario } from '@chat/shared';

function toTurns(messages: Message[]) {
  return messages.flatMap((m) =>
    m.role === 'user' ? [{ role: 'user' as const, content: m.content }] : [],
  );
}

export default function App() {
  const [state, dispatch] = useReducer(chatReducer, undefined, loadState);

  // Mirror every mutation so a reload does not lose the draft.
  useEffect(() => {
    saveState(state);
  }, [state]);

  const request = useCallback(
    async (turns: { role: 'user'; content: string }[], fields: PinnedField[]) => {
      await streamChat({ messages: turns, fields }, (e) => {
        const data = e.data as Record<string, any>;
        if (e.event === 'status') dispatch({ type: 'status', phase: data.phase });
        else if (e.event === 'analyzeStep') dispatch({ type: 'analyzeStep', label: data.label });
        else if (e.event === 'envelope') dispatch({ type: 'envelope', envelope: data.envelope });
        else if (e.event === 'fallback')
          dispatch({ type: 'fallback', prose: data.prose, candidates: data.candidates });
        else if (e.event === 'error')
          dispatch({
            type: 'error',
            kind: data.kind === 'offline' ? 'offline' : 'api',
            message: data.message,
            retry: turns.filter((t) => t.role === 'user').at(-1)?.content ?? null,
          });
      });
    },
    [],
  );

  const send = useCallback(
    async (text: string) => {
      dispatch({ type: 'send', content: text });
      const turns = [...toTurns(state.messages), { role: 'user' as const, content: text }];
      await request(turns, Object.values(state.fields));
    },
    [state.messages, state.fields, request],
  );

  const recalculate = useCallback(async () => {
    dispatch({ type: 'recalculate' });
    await request(toTurns(state.messages), Object.values(state.fields));
  }, [state.messages, state.fields, request]);

  const edit = useCallback((key: string, value: string) => {
    dispatch({ type: 'editField', key, value });
  }, []);

  const acceptProposal = useCallback((key: string) => {
    dispatch({ type: 'acceptProposal', key });
  }, []);

  const rejectProposal = useCallback((key: string) => {
    dispatch({ type: 'rejectProposal', key });
  }, []);

  const pinCandidate = useCallback((key: string, label: string, value: string) => {
    dispatch({ type: 'pinCandidate', key, label, value });
  }, []);

  const saveScenario = useCallback((scenario: Scenario) => {
    dispatch({ type: 'saveScenario', scenario });
  }, []);

  const deleteScenario = useCallback((id: string) => {
    dispatch({ type: 'deleteScenario', id });
  }, []);

  const undoDelete = useCallback(() => {
    dispatch({ type: 'undoDelete' });
  }, []);

  const revertChange = useCallback((key: string) => {
    dispatch({ type: 'revertChange', key });
  }, []);

  const dismissChanges = useCallback(() => {
    dispatch({ type: 'dismissChanges' });
  }, []);

  return (
    <div className="flex h-full flex-col">
      <TopNav context={state.messages.length > 0 ? 'Depa Pueblo Libre · sin guardar' : undefined} />
      {state.messages.length === 0 ? (
        <EmptyState onSubmit={send} />
      ) : (
        <Conversation
          state={state}
          onSend={send}
          onEdit={edit}
          onAcceptProposal={acceptProposal}
          onRejectProposal={rejectProposal}
          onPinCandidate={pinCandidate}
          savedIds={state.savedScenarios.map((s) => s.id)}
          onSaveScenario={(id) => {
            // The model reuses scenario ids across turns, so search from the
            // most recent message backwards to grab the current values.
            for (let i = state.messages.length - 1; i >= 0; i -= 1) {
              const m = state.messages[i]!;
              if (m.role !== 'assistant') continue;
              const scenario = m.envelope.scenarios.find((s) => s.id === id);
              if (scenario) {
                saveScenario(scenario);
                break;
              }
            }
          }}
          onDeleteScenario={deleteScenario}
          onUndoDelete={undoDelete}
          onRecalculate={recalculate}
          onRevertChange={revertChange}
          onDismissChanges={dismissChanges}
        />
      )}
    </div>
  );
}
