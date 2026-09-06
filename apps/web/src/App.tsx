import { useCallback, useReducer } from 'react';
import { streamChat } from './api/streamChat';
import { TopNav } from './components/TopNav';
import { Conversation } from './screens/Conversation';
import { EmptyState } from './screens/EmptyState';
import { chatReducer, initialState, type Message } from './state/chatReducer';

function toTurns(messages: Message[]) {
  return messages.flatMap((m) =>
    m.role === 'user' ? [{ role: 'user' as const, content: m.content }] : [],
  );
}

export default function App() {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  const send = useCallback(
    async (text: string) => {
      dispatch({ type: 'send', content: text });

      const history = [...toTurns(state.messages), { role: 'user' as const, content: text }];
      await streamChat({ messages: history, fields: Object.values(state.fields) }, (e) => {
        const data = e.data as Record<string, any>;
        if (e.event === 'status') dispatch({ type: 'status', phase: data.phase });
        else if (e.event === 'analyzeStep') dispatch({ type: 'analyzeStep', label: data.label });
        else if (e.event === 'envelope') dispatch({ type: 'envelope', envelope: data.envelope });
        else if (e.event === 'fallback')
          dispatch({ type: 'fallback', prose: data.prose, candidates: data.candidates });
        else if (e.event === 'error') dispatch({ type: 'error', message: data.message });
      });
    },
    [state.messages, state.fields],
  );

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
        />
      )}
    </div>
  );
}
