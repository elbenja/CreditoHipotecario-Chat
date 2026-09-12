import { useCallback, useEffect, useReducer, useState } from 'react';
import { streamChat } from './api/streamChat';
import { TopNav } from './components/TopNav';
import { UndoBar } from './components/UndoBar';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { Conversation } from './screens/Conversation';
import { EmptyState } from './screens/EmptyState';
import { chatReducer, type ChatState } from './state/chatReducer';
import { loadState, saveState } from './state/persistence';
import { toTurns } from './state/guidance';
import { findListingUrl, isListingHost, type FieldKey, type PinnedField, type Scenario } from '@chat/shared';
import { readListing } from './listing/readListing';

export default function App() {
  const [state, dispatch] = useReducer(chatReducer, undefined, loadState);
  // Seeds the composer with a failed question so the user can edit it. `n`
  // forces the effect to re-fire even when re-editing the same question twice.
  const [composerSeed, setComposerSeed] = useState<{ text: string; n: number } | null>(null);
  // The whole conversation, held only long enough for the undo bar to offer it
  // back. Outside the reducer on purpose: it must not reach localStorage.
  const [beforeReset, setBeforeReset] = useState<ChatState | null>(null);

  // Mirror every mutation so a reload does not lose the draft.
  useEffect(() => {
    saveState(state);
  }, [state]);

  const online = useOnlineStatus();
  useEffect(() => {
    dispatch({ type: 'setOffline', offline: !online });
  }, [online]);

  const request = useCallback(
    async (turns: { role: 'user' | 'assistant'; content: string }[], fields: PinnedField[]) => {
      await streamChat({ messages: turns, fields }, (e) => {
        const data = e.data as Record<string, any>;
        if (e.event === 'status') dispatch({ type: 'status', phase: data.phase });
        else if (e.event === 'analyzeStep') dispatch({ type: 'analyzeStep', label: data.label });
        else if (e.event === 'envelope')
          dispatch({
            type: 'envelope',
            envelope: data.envelope,
            truncated: data.truncated,
            outOfScope: data.outOfScope,
          });
        else if (e.event === 'fallback')
          dispatch({
            type: 'fallback',
            prose: data.prose,
            candidates: data.candidates,
            truncated: data.truncated,
          });
        else if (e.event === 'error')
          dispatch({
            type: 'error',
            kind: data.kind === 'offline' || data.kind === 'request' || data.kind === 'limit'
              ? data.kind
              : 'api',
            message: data.message,
            retry: turns.filter((t) => t.role === 'user').at(-1)?.content ?? null,
          });
      });
    },
    [],
  );

  const send = useCallback(
    async (text: string) => {
      // A pasted link is a read, not a question. The refusal is local; the
      // read goes through its own request with the URL as the payload.
      const link = findListingUrl(text);
      if (link && !isListingHost(link.host)) {
        dispatch({ type: 'refuseListing', content: text, host: link.host });
        return;
      }
      // Offline: the message is pending, not lost — hold it for reconnect.
      if (state.offline) {
        dispatch({ type: 'queue', content: text });
        return;
      }
      dispatch({ type: 'send', content: text });
      if (link) {
        await readListing(link.url, link.host, dispatch, Object.values(state.fields));
        return;
      }
      const turns = toTurns([...state.messages, { id: 'pending', role: 'user', content: text, respondingTo: state.pendingField ?? undefined }]);
      await request(turns, Object.values(state.fields));
    },
    [state.offline, state.messages, state.fields, state.pendingField, request],
  );

  // Connectivity returned with a message waiting: send it on the user's behalf.
  useEffect(() => {
    if (!state.offline && state.queued) {
      const text = state.queued;
      dispatch({ type: 'dequeue' });
      void send(text);
    }
  }, [state.offline, state.queued, send]);

  const recalculate = useCallback(async () => {
    dispatch({ type: 'recalculate' });
    await request([...toTurns(state.messages), { role: 'user', content: 'Recalcula el último análisis solicitado con los datos actuales del panel.' }], Object.values(state.fields));
  }, [state.messages, state.fields, request]);

  const retry = useCallback(async () => {
    dispatch({ type: 'clearError' });
    const failedRequest = state.error?.retry;
    // A failed link turn's "retry" is the URL itself, not a chat question —
    // resending it as a plain user turn would ask the model about the URL
    // text instead of reading the page again.
    const link = failedRequest ? findListingUrl(failedRequest) : null;
    if (link && isListingHost(link.host)) {
      await readListing(link.url, link.host, dispatch, Object.values(state.fields));
      return;
    }
    const turns = toTurns(state.messages);
    if (failedRequest && turns.at(-1)?.content !== failedRequest) {
      turns.push({ role: 'user', content: failedRequest });
    }
    await request(turns, Object.values(state.fields));
  }, [state.messages, state.fields, state.error, request]);

  const editQuestion = useCallback(() => {
    const failedQuestion = state.error?.retry;
    dispatch({ type: 'clearError' });
    if (failedQuestion) {
      setComposerSeed((prev) => ({ text: failedQuestion, n: (prev?.n ?? 0) + 1 }));
    }
  }, [state.error]);

  const edit = useCallback((key: string, value: string) => {
    dispatch({ type: 'editField', key, value });
  }, []);

  const editMortgage = useCallback((key: string, value: string) => {
    dispatch({ type: 'editMortgageField', key, value });
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

  const reset = useCallback(() => {
    setBeforeReset(state);
    dispatch({ type: 'reset' });
  }, [state]);

  const undoReset = useCallback(() => {
    if (!beforeReset) return;
    dispatch({ type: 'restore', state: beforeReset });
    setBeforeReset(null);
  }, [beforeReset]);

  // The reset control needs something to forget. A schedule read before the
  // first message counts: without this, a PDF-only session had no way back.
  const context =
    state.messages.length > 0
      ? `${state.fields.ubicacion?.value ?? 'Tu propiedad'} · sin guardar`
      : Object.keys(state.mortgage).length > 0
        ? 'Cronograma leído · sin guardar'
        : undefined;

  return (
    <div className="relative flex h-full flex-col">
      <TopNav context={context} onReset={reset} />
      {state.messages.length === 0 ? (
        <EmptyState
          onSubmit={send}
          onAskField={(key: FieldKey) => dispatch({ type: 'askField', key })}
          state={state}
          dispatch={dispatch}
        />
      ) : (
        <Conversation
          state={state}
          onAskField={(key: FieldKey) => dispatch({ type: 'askField', key })}
          onSend={send}
          onEdit={edit}
          onEditMortgage={editMortgage}
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
          onRetry={retry}
          onEditQuestion={editQuestion}
          onContinue={() => send('Continúa desde donde te quedaste.')}
          onShorten={() => send('Resúmelo más corto, por favor.')}
          composerSeed={composerSeed}
          dispatch={dispatch}
        />
      )}

      {/*
        Lives here, not in Conversation: a reset unmounts that screen. The
        wrapper keeps it centred over the transcript rather than the whole
        app, so it never lands under the pinned panel.
      */}
      <div className="absolute inset-x-0 bottom-0 md:right-panel">
        <UndoBar
          visible={beforeReset !== null}
          label="Conversación reiniciada"
          onUndo={undoReset}
          onExpire={() => setBeforeReset(null)}
        />
      </div>
    </div>
  );
}
