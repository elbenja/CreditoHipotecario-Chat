import { useReducer } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MortgageField } from '@chat/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmptyState } from './EmptyState';
import { chatReducer, initialState } from '../state/chatReducer';
import { readFirstPage } from '../pdf/readPdf';
import { streamChat } from '../api/streamChat';

// The attach flow reads the file and calls the model; neither may run for
// real in a unit test — no live model calls, no touching an actual PDF.
vi.mock('../pdf/readPdf', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../pdf/readPdf')>();
  return { ...actual, readFirstPage: vi.fn() };
});

vi.mock('../api/streamChat', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/streamChat')>();
  return { ...actual, streamChat: vi.fn() };
});

describe('EmptyState', () => {
  it('renders the mobile prompt, suggestions, and empty summary', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<EmptyState onSubmit={onSubmit} state={initialState} />);

    expect(
      screen.getByText(
        'Cuéntamelo en tus palabras. Voy fijando los datos abajo y los puedes corregir cuando quieras.',
      ),
    ).toBeInTheDocument();

    const suggestions = screen.getByRole('region', {
      name: 'Preguntas sugeridas para móvil',
    });
    const questionButtons = within(suggestions).getAllByRole('button');

    expect(questionButtons).toHaveLength(3);
    await user.click(questionButtons[1]!);
    expect(onSubmit).toHaveBeenCalledWith('¿Es un buen negocio?');
    expect(screen.getByText('Ningún dato fijado todavía')).toBeInTheDocument();
  });

  it('has no attach control when no dispatch is wired', () => {
    render(<EmptyState onSubmit={vi.fn()} state={initialState} />);
    expect(screen.queryAllByLabelText(/adjuntar cronograma/i)).toHaveLength(0);
  });
});

// Fix 3: the attach control used to be reachable only after the first
// message, since EmptyState never passed onAttach to either of its two
// Composers (mobile and desktop `variant="empty"`). This proves both are now
// wired to the same flow Conversation uses.
describe('EmptyState attach flow', () => {
  beforeAll(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });
  afterAll(() => {
    // @ts-expect-error -- test-only cleanup, not worth typing
    delete HTMLElement.prototype.scrollIntoView;
  });

  beforeEach(() => {
    vi.mocked(readFirstPage).mockReset();
    vi.mocked(streamChat).mockReset();
  });

  function Harness() {
    const [state, dispatch] = useReducer(chatReducer, initialState);
    return <EmptyState onSubmit={vi.fn()} state={state} dispatch={dispatch} />;
  }

  const pdf = (name = 'cronograma.pdf') => new File([new Uint8Array(1)], name, { type: 'application/pdf' });

  const mortgageFields: MortgageField[] = [
    { key: 'tea', label: 'TEA', value: '6.30%', prefix: undefined, suffix: undefined, provenance: 'documento', note: '' },
  ];

  it('offers an attach control on both the mobile and desktop composers', () => {
    render(<Harness />);
    expect(screen.getAllByLabelText(/adjuntar cronograma/i)).toHaveLength(2);
  });

  it('opens the confirmation modal after attaching from the empty state', async () => {
    vi.mocked(readFirstPage).mockResolvedValue({ kind: 'text', text: 'TEA 6.30' });
    vi.mocked(streamChat).mockImplementation(async (_body, onEvent) => {
      onEvent({ event: 'extraction', data: { fields: mortgageFields } });
    });
    render(<Harness />);

    const [mobileInput] = screen.getAllByTestId('attach-input');
    await userEvent.upload(mobileInput!, pdf());

    expect(await screen.findByRole('dialog', { name: /revisar lo que leí/i })).toBeInTheDocument();
  });

  it('surfaces a read failure without leaving the empty state', async () => {
    vi.mocked(readFirstPage).mockRejectedValue(new Error('boom'));
    render(<Harness />);

    const [mobileInput] = screen.getAllByTestId('attach-input');
    await userEvent.upload(mobileInput!, pdf());

    expect((await screen.findAllByText('No pude leer ese PDF.')).length).toBeGreaterThan(0);
  });
});
