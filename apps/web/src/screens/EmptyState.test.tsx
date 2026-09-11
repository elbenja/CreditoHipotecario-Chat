import { useReducer } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
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

  // The bug: confirming pinned into state, but the empty screen kept
  // rendering its static placeholder panel, so "Fijar estos datos" looked
  // like it did nothing.
  it('shows the pinned panel with a Hipoteca group once the read is confirmed', async () => {
    vi.mocked(readFirstPage).mockResolvedValue({ kind: 'text', text: 'TEA 6.30' });
    vi.mocked(streamChat).mockImplementation(async (_body, onEvent) => {
      onEvent({ event: 'extraction', data: { fields: mortgageFields } });
    });
    render(<Harness />);

    const [mobileInput] = screen.getAllByTestId('attach-input');
    await userEvent.upload(mobileInput!, pdf());
    await userEvent.click(await screen.findByRole('button', { name: /fijar estos datos/i }));

    // Desktop panel and mobile sheet both render: the group header appears in
    // the panel, the count in the mobile summary.
    expect(screen.getByRole('button', { name: /^hipoteca/i })).toBeInTheDocument();
    expect(screen.getByLabelText('TEA')).toHaveValue('6.30%');
    expect(screen.getByText('1 datos fijados')).toBeInTheDocument();
    expect(screen.queryByText('Ningún dato fijado todavía')).not.toBeInTheDocument();
    expect(screen.queryByText('Se van fijando solos mientras conversas.')).not.toBeInTheDocument();
  });

  it('shows the file being read under the composer', async () => {
    vi.mocked(readFirstPage).mockReturnValue(new Promise(() => {}));
    render(<Harness />);

    const [mobileInput] = screen.getAllByTestId('attach-input');
    await userEvent.upload(mobileInput!, pdf('bcp-2026.pdf'));

    expect((await screen.findAllByText('bcp-2026.pdf')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Leyendo tu cronograma…').length).toBeGreaterThan(0);
  });

  it('reads a PDF dropped on the empty screen', async () => {
    vi.mocked(readFirstPage).mockReturnValue(new Promise(() => {}));
    render(<Harness />);

    const file = pdf('soltado.pdf');
    const dt = { items: [{ kind: 'file', type: 'application/pdf' }], files: [file], types: ['Files'] };
    const heading = screen.getAllByText('¿Qué depa estás evaluando?')[0]!;
    fireEvent.dragEnter(heading, { dataTransfer: dt });
    expect(screen.getByText('Suelta tu cronograma aquí')).toBeInTheDocument();
    fireEvent.drop(heading, { dataTransfer: dt });

    expect((await screen.findAllByText('soltado.pdf')).length).toBeGreaterThan(0);
    expect(readFirstPage).toHaveBeenCalledWith(file);
  });

  it('surfaces a read failure without leaving the empty state', async () => {
    vi.mocked(readFirstPage).mockRejectedValue(new Error('boom'));
    render(<Harness />);

    const [mobileInput] = screen.getAllByTestId('attach-input');
    await userEvent.upload(mobileInput!, pdf());

    expect((await screen.findAllByText('No pude leer ese PDF.')).length).toBeGreaterThan(0);
  });
});
