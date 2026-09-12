import { useReducer } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnalysisEnvelope, MortgageField, PinnedField } from '@chat/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Conversation } from './Conversation';
import { chatReducer, initialState, type Action, type ChatState } from '../state/chatReducer';
import { PdfReadError, readFirstPage } from '../pdf/readPdf';
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

function renderConversation(conversationState: ChatState = state, opts: { dispatch?: (a: Action) => void } = {}) {
  return render(
    <Conversation
      state={conversationState}
      dispatch={opts.dispatch}
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

function scenarioReadyState(): ChatState {
  const fields = Object.fromEntries([
    ['precio', field],
    ['inicial', { ...field, key: 'inicial', label: 'Cuota inicial', value: '20', suffix: '%' }],
    ['tasa', { ...field, key: 'tasa', label: 'Tasa', value: '8', suffix: '%' }],
    ['plazo', { ...field, key: 'plazo', label: 'Plazo', value: '20', suffix: 'años' }],
  ]) as ChatState['fields'];
  return {
    ...state,
    fields,
    messages: [
      state.messages[0]!,
      { id: 'capture', role: 'assistant', envelope: { ...envelope, kind: 'capture', fields: [], metrics: [], prose: [], followUps: [] } },
    ],
  };
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

  it('disables out-of-scope follow-ups while the conversation is busy', () => {
    const outOfScopeState: ChatState = {
      ...state,
      status: 'thinking',
      messages: [
        state.messages[0]!,
        { id: 'assistant-out-of-scope', role: 'assistant', envelope, outOfScope: true },
      ],
    };
    renderConversation(outOfScopeState);

    expect(screen.getByRole('button', { name: '¿Y con 30% de inicial?' })).toBeDisabled();
  });

  it('states once that the figures are model-produced', () => {
    renderConversation();
    expect(screen.getByText('números indicativos · POC')).toBeTruthy();
  });

  it('does not offer Continue for a legacy empty truncated reply', () => {
    renderConversation({
      ...state,
      messages: [
        state.messages[0]!,
        { id: 'empty', role: 'assistant-fallback', prose: '   ', candidates: [], truncated: true },
      ],
    });
    expect(screen.queryByRole('button', { name: 'Continuar' })).not.toBeInTheDocument();
  });

  it('labels a model rejection without calling it a connection failure', () => {
    renderConversation({
      ...state,
      status: 'error',
      error: { kind: 'request', message: 'La solicitud no fue válida.', retry: 'hola' },
    });
    expect(screen.getByText('Kimi rechazó la solicitud')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reintentar/ })).not.toBeInTheDocument();
  });

  it('shows the scenario badge first with the existing bookmark-add icon', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(
      <Conversation
        state={scenarioReadyState()}
        onAskField={vi.fn()}
        onSend={onSend}
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

    const badge = screen.getByRole('button', { name: 'Qué pasa si mueves una palanca' });
    expect(badge).toHaveClass('text-ch-accent');
    expect(badge.querySelector('.hgi-bookmark-add-02')).toBeInTheDocument();
    const normalSuggestion = screen.getByRole('button', { name: '¿Cuánto pagaría al mes?' });
    expect(badge.compareDocumentPosition(normalSuggestion) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await user.click(badge);
    expect(onSend).toHaveBeenCalledWith('Qué pasa si mueves una palanca');
  });
});

describe('Conversation attach flow', () => {
  const scrollIntoView2 = HTMLElement.prototype.scrollIntoView;

  beforeAll(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterAll(() => {
    HTMLElement.prototype.scrollIntoView = scrollIntoView2;
  });

  beforeEach(() => {
    vi.mocked(readFirstPage).mockReset();
    vi.mocked(streamChat).mockReset();
  });

  // Wires a real dispatch (chatReducer, same as App.tsx) so the attach flow's
  // several actions (status/error/extractionReady/confirmExtraction) actually
  // land in state and re-render, instead of a fixed fixture state.
  function Harness() {
    const [convState, dispatch] = useReducer(chatReducer, initialState);
    return (
      <Conversation
        state={convState}
        dispatch={dispatch}
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
      />
    );
  }

  const pdf = (name = 'cronograma.pdf') => new File([new Uint8Array(1)], name, { type: 'application/pdf' });

  const mortgageFields: MortgageField[] = [
    { key: 'tea', label: 'TEA', value: '6.30%', prefix: undefined, suffix: undefined, provenance: 'documento', note: '' },
    {
      key: 'montoFinanciado',
      label: 'Monto financiado',
      value: 'S/ 250,000',
      prefix: 'S/',
      suffix: undefined,
      provenance: 'documento',
      note: '',
    },
  ];

  it('tells the user their PDF is not a PDF', async () => {
    vi.mocked(readFirstPage).mockRejectedValue(new PdfReadError('notPdf'));
    render(<Harness />);

    await userEvent.upload(screen.getByTestId('attach-input'), pdf());

    expect(await screen.findByText('Eso no es un PDF. Sube el cronograma que te dio el banco.')).toBeInTheDocument();
  });

  it('tells the user their PDF is too large', async () => {
    vi.mocked(readFirstPage).mockRejectedValue(new PdfReadError('tooLarge'));
    render(<Harness />);

    await userEvent.upload(screen.getByTestId('attach-input'), pdf());

    expect(await screen.findByText('Ese archivo pasa los 20 MB. Sube solo el cronograma.')).toBeInTheDocument();
  });

  // The one the brief calls out by name: a password-protected file must say
  // so, not fall into the generic "no pude leer" bucket.
  it('tells the user their PDF has a password, not the generic unreadable message', async () => {
    vi.mocked(readFirstPage).mockRejectedValue(new PdfReadError('encrypted'));
    render(<Harness />);

    await userEvent.upload(screen.getByTestId('attach-input'), pdf());

    expect(await screen.findByText('Ese PDF tiene contraseña y no puedo abrirlo.')).toBeInTheDocument();
    expect(screen.queryByText('No pude leer ese PDF.')).not.toBeInTheDocument();
  });

  it('falls back to the generic message for any other read failure', async () => {
    vi.mocked(readFirstPage).mockRejectedValue(new PdfReadError('unreadable'));
    render(<Harness />);

    await userEvent.upload(screen.getByTestId('attach-input'), pdf());

    expect(await screen.findByText('No pude leer ese PDF.')).toBeInTheDocument();
  });

  it('opens the confirmation modal instead of pinning the extraction directly', async () => {
    vi.mocked(readFirstPage).mockResolvedValue({ kind: 'text', text: 'TEA 6.30' });
    vi.mocked(streamChat).mockImplementation(async (_body, onEvent) => {
      onEvent({ event: 'extraction', data: { fields: mortgageFields } });
    });
    render(<Harness />);

    await userEvent.upload(screen.getByTestId('attach-input'), pdf());

    expect(await screen.findByRole('dialog', { name: /revisar lo que leí/i })).toBeInTheDocument();
    expect(screen.queryByText('Hipoteca')).not.toBeInTheDocument();
  });

  it('pins the confirmed fields into the panel', async () => {
    vi.mocked(readFirstPage).mockResolvedValue({ kind: 'text', text: 'TEA 6.30' });
    vi.mocked(streamChat).mockImplementation(async (_body, onEvent) => {
      onEvent({ event: 'extraction', data: { fields: mortgageFields } });
    });
    const user = userEvent.setup();
    render(<Harness />);

    await user.upload(screen.getByTestId('attach-input'), pdf());
    await screen.findByRole('dialog', { name: /revisar lo que leí/i });

    await user.click(screen.getByRole('button', { name: 'Fijar estos datos' }));

    expect(screen.queryByRole('dialog', { name: /revisar lo que leí/i })).not.toBeInTheDocument();
    expect(screen.getAllByText('Hipoteca').length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue('6.30%').length).toBeGreaterThan(0);
  });

  it('pins nothing when the confirmation is cancelled', async () => {
    vi.mocked(readFirstPage).mockResolvedValue({ kind: 'text', text: 'TEA 6.30' });
    vi.mocked(streamChat).mockImplementation(async (_body, onEvent) => {
      onEvent({ event: 'extraction', data: { fields: mortgageFields } });
    });
    const user = userEvent.setup();
    render(<Harness />);

    await user.upload(screen.getByTestId('attach-input'), pdf());
    await screen.findByRole('dialog', { name: /revisar lo que leí/i });

    await user.click(screen.getByRole('button', { name: 'Descartar' }));

    expect(screen.queryByRole('dialog', { name: /revisar lo que leí/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Hipoteca')).not.toBeInTheDocument();
  });

  // Pins Finding 1: a second attach must not be possible while a read is in
  // flight — two overlapping attach() calls would both write to the same
  // dispatch, the later extractionReady silently overwriting the earlier.
  it('disables the attach control while a read is in flight', async () => {
    vi.mocked(readFirstPage).mockReturnValue(new Promise(() => {})); // never settles: still "in flight"
    render(<Harness />);

    await userEvent.upload(screen.getByTestId('attach-input'), pdf());

    expect(await screen.findByLabelText('Adjuntar cronograma')).toBeDisabled();
    expect(screen.getByTestId('attach-input')).toBeDisabled();
  });

  // Card 09: a read in flight shows the file's own row, not the generic
  // thinking dots — the user needs to see that *their file* is being read.
  it('shows the file being read instead of the thinking dots', async () => {
    vi.mocked(readFirstPage).mockReturnValue(new Promise(() => {}));
    render(<Harness />);

    await userEvent.upload(screen.getByTestId('attach-input'), pdf('bcp-2026.pdf'));

    expect(await screen.findByText('bcp-2026.pdf')).toBeInTheDocument();
    expect(screen.getByText('Leyendo tu cronograma…')).toBeInTheDocument();
    expect(screen.queryByTestId('thinking')).not.toBeInTheDocument();
  });

  // Card 10: a schedule dropped anywhere on the chat column goes through the
  // same flow as the picker.
  it('reads a PDF dropped on the chat', async () => {
    vi.mocked(readFirstPage).mockReturnValue(new Promise(() => {}));
    render(<Harness />);

    const file = pdf('soltado.pdf');
    const dt = { items: [{ kind: 'file', type: 'application/pdf' }], files: [file], types: ['Files'] };
    const composer = screen.getByPlaceholderText('Pregunta lo que quieras…');
    fireEvent.dragEnter(composer, { dataTransfer: dt });
    expect(screen.getByText('Suelta tu cronograma aquí')).toBeInTheDocument();
    fireEvent.drop(composer, { dataTransfer: dt });

    expect(await screen.findByText('soltado.pdf')).toBeInTheDocument();
    expect(readFirstPage).toHaveBeenCalledWith(file);
  });

  it('takes the row down once the read is ready to review', async () => {
    vi.mocked(readFirstPage).mockResolvedValue({ kind: 'text', text: 'TEA 6.30' });
    vi.mocked(streamChat).mockImplementation(async (_body, onEvent) => {
      onEvent({ event: 'extraction', data: { fields: mortgageFields } });
    });
    render(<Harness />);

    await userEvent.upload(screen.getByTestId('attach-input'), pdf('bcp-2026.pdf'));

    expect(await screen.findByRole('dialog', { name: /revisar lo que leí/i })).toBeInTheDocument();
    expect(screen.queryByText('bcp-2026.pdf')).not.toBeInTheDocument();
  });
});

describe('listing on the conversation screen', () => {
  const scrollIntoView3 = HTMLElement.prototype.scrollIntoView;

  beforeAll(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterAll(() => {
    HTMLElement.prototype.scrollIntoView = scrollIntoView3;
  });

  it('renders an assistant-note as plain text', () => {
    renderConversation({ ...state, messages: [{ id: 'n', role: 'assistant-note', content: 'Fijé ubicación del anuncio.' }] });
    expect(screen.getByText('Fijé ubicación del anuncio.')).toBeInTheDocument();
  });

  it('mounts the anuncio modal while a listing is pending, and cancelling dispatches cancelListing', async () => {
    const dispatch = vi.fn();
    renderConversation(
      { ...state, pendingListing: { proyecto: 'A', distrito: 'Lince', modelos: [{ area: '55', precioDesde: '300,000' }], fuente: { host: 'pdf' }, dudosos: [] } },
      { dispatch },
    );
    expect(screen.getByRole('dialog', { name: /anuncio/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /descartar/i }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'cancelListing' });
  });

  it('titles a listing error as such', () => {
    renderConversation({ ...state, status: 'error', error: { kind: 'listing', message: 'No pude abrir ese anuncio.', retry: 'https://nexoinmobiliario.pe/x' } });
    expect(screen.getByText('No pude leer el anuncio')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reintentar/i })).toBeNull();
    expect(screen.getByRole('button', { name: /editar/i })).toBeInTheDocument();
  });
});
