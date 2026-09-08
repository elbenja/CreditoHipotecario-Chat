import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  followUps: ['¿Y con 30% de inicial?'],
};

const state: ChatState = {
  ...initialState,
  messages: [
    { id: 'user-1', role: 'user', content: '¿Puedo comprar este departamento?' },
    { id: 'assistant-1', role: 'assistant', envelope },
  ],
  fields: { [field.key]: field },
};

function renderConversation(conversationState: ChatState = state) {
  return render(
    <Conversation
      state={conversationState}
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

  it('renders the mobile operation-sheet trigger and mobile metric width', async () => {
    const user = userEvent.setup();
    renderConversation();

    const trigger = screen.getByRole('button', { name: 'Abrir datos de la operación' });
    expect(trigger).toHaveTextContent('1 datos fijados');
    expect(trigger.closest('section')).toHaveClass('relative', 'flex-none', 'w-full');

    const metricValue = screen.getByText('S/ 2,400');
    expect(metricValue.parentElement).toHaveClass('w-[150px]');
    expect(metricValue.parentElement?.parentElement).toHaveClass('-mr-5', 'pr-10', 'md:mr-0', 'md:pr-0');

    const followUps = screen.getAllByRole('button', { name: '¿Y con 30% de inicial?' });
    const mobileFollowUp = followUps.find((button) => button.parentElement?.classList.contains('md:hidden'));
    expect(mobileFollowUp).toBeDefined();
    expect(mobileFollowUp?.parentElement).toHaveClass('-mr-5', 'pr-10', 'md:mr-0', 'md:pr-0', 'mb-3');

    const desktopFollowUp = followUps.find((button) => button.parentElement?.classList.contains('hidden'));
    expect(desktopFollowUp).toBeDefined();

    await user.click(screen.getByPlaceholderText('Pregunta lo que quieras…'));
    const focusedFollowUp = screen
      .getAllByRole('button', { name: '¿Y con 30% de inicial?' })
      .find((button) => button.parentElement?.classList.contains('ch-rise'));
    expect(focusedFollowUp?.parentElement).toHaveClass('hidden', 'md:flex');

    const mobileVisibleFollowUps = screen
      .getAllByRole('button', { name: '¿Y con 30% de inicial?' })
      .filter((button) => !button.parentElement?.classList.contains('hidden'));
    expect(mobileVisibleFollowUps).toHaveLength(1);

    expect(trigger.closest('section')).toHaveClass('mt-3');

    const composerWrapper = screen.getByPlaceholderText('Pregunta lo que quieras…').parentElement?.parentElement?.parentElement;
    expect(composerWrapper).toHaveClass('px-5', 'pt-3', 'pb-0');
  });

  it('disables mobile follow-up actions while the conversation is busy', () => {
    renderConversation({ ...state, status: 'thinking' });

    const mobileFollowUp = screen
      .getAllByRole('button', { name: '¿Y con 30% de inicial?' })
      .find((button) => button.parentElement?.classList.contains('md:hidden'));
    expect(mobileFollowUp).toBeDisabled();
  });

  it('keeps out-of-scope follow-ups in the transcript without mobile footer duplicates', async () => {
    const user = userEvent.setup();
    const outOfScopeState: ChatState = {
      ...state,
      messages: [
        state.messages[0]!,
        { id: 'assistant-out-of-scope', role: 'assistant', envelope, outOfScope: true },
      ],
    };
    renderConversation(outOfScopeState);

    const transcriptFollowUps = screen.getAllByRole('button', { name: '¿Y con 30% de inicial?' });
    expect(transcriptFollowUps).toHaveLength(1);
    expect(transcriptFollowUps[0]?.parentElement).toHaveClass('mt-3');

    await user.click(screen.getByPlaceholderText('Pregunta lo que quieras…'));
    expect(screen.getAllByRole('button', { name: '¿Y con 30% de inicial?' })).toHaveLength(1);
  });
});
