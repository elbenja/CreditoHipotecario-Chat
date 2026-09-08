import { render, screen } from '@testing-library/react';
import type { AnalysisEnvelope, PinnedField } from '@chat/shared';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Conversation } from './Conversation';
import { initialState, type ChatState } from '../state/chatReducer';

const scrollIntoView = HTMLElement.prototype.scrollIntoView;

const field: PinnedField = {
  key: 'precio',
  label: 'Precio',
  value: 'S/ 300,000',
  prefix: 'S/',
  suffix: undefined,
  provenance: 'user',
  note: '',
};

const envelope: AnalysisEnvelope = {
  verdict: 'La operación se ve razonable.',
  fields: [],
  metrics: [{ label: 'Cuota mensual', value: 'S/ 2,400', delta: null, context: '' }],
  scenarios: [],
  sources: [],
  prose: ['Una cuota dentro de tu rango.'],
  followUps: [],
};

const state: ChatState = {
  ...initialState,
  messages: [
    { id: 'user-1', role: 'user', content: '¿Puedo comprar este departamento?' },
    { id: 'assistant-1', role: 'assistant', envelope },
  ],
  fields: { [field.key]: field },
};

function renderConversation() {
  return render(
    <Conversation
      state={state}
      onSend={vi.fn()}
      onEdit={vi.fn()}
      onAcceptProposal={vi.fn()}
      onRejectProposal={vi.fn()}
      onPinCandidate={vi.fn()}
      savedIds={[]}
      onSaveScenario={vi.fn()}
      onDeleteScenario={vi.fn()}
      onUndoDelete={vi.fn()}
      onRecalculate={vi.fn()}
      onRevertChange={vi.fn()}
      onDismissChanges={vi.fn()}
      onRetry={vi.fn()}
      onEditQuestion={vi.fn()}
      onContinue={vi.fn()}
      onShorten={vi.fn()}
      composerSeed={null}
    />,
  );
}

describe('Conversation mobile integration', () => {
  beforeAll(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterAll(() => {
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
  });

  it('renders the mobile operation-sheet trigger and mobile metric width', () => {
    renderConversation();

    const trigger = screen.getByRole('button', { name: 'Abrir datos de la operación' });
    expect(trigger).toHaveTextContent('1 datos fijados');

    const metricValue = screen.getByText('S/ 2,400');
    expect(metricValue.parentElement).toHaveClass('w-[150px]');
  });
});
