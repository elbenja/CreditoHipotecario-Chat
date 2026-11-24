import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { setDemoRemaining } from '../api/access';
import { es } from '../i18n/es';
import { initialState, type ChatState } from '../state/chatReducer';
import { DemoGuide } from './DemoGuide';

const [one, two] = es.demo.steps.map((s) => s.prompt!);
const state: ChatState = { ...initialState, messages: [{ id: 'u1', role: 'user', content: one! }] };

describe('DemoGuide', () => {
  it('shows the current step, its prompt and the questions left', () => {
    setDemoRemaining(5);
    render(<DemoGuide state={state} onSend={vi.fn()} disabled={false} />);
    expect(screen.getByText('Demo · paso 2 de 4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: two })).toBeInTheDocument();
    expect(screen.getByText('Quedan 5 preguntas')).toBeInTheDocument();
  });

  it('sends the step prompt', async () => {
    const onSend = vi.fn();
    render(<DemoGuide state={state} onSend={onSend} disabled={false} />);
    await userEvent.click(screen.getByRole('button', { name: two }));
    expect(onSend).toHaveBeenCalledWith(two);
  });

  it('is disabled while busy', () => {
    render(<DemoGuide state={state} onSend={vi.fn()} disabled />);
    expect(screen.getByRole('button', { name: two })).toBeDisabled();
  });

  it('closes the path once a scenario is saved', () => {
    const done: ChatState = {
      ...initialState,
      messages: es.demo.steps.slice(0, 3).map((s, i) => ({ id: `u${i}`, role: 'user' as const, content: s.prompt! })),
      savedScenarios: [{} as ChatState['savedScenarios'][number]],
    };
    render(<DemoGuide state={done} onSend={vi.fn()} disabled={false} />);
    expect(screen.getByText(es.demo.done)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
