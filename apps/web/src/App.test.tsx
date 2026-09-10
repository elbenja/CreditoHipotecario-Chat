import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { initialState, type ChatState } from './state/chatReducer';
import { STORAGE_KEY } from './state/persistence';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

const withMortgage: ChatState = {
  ...initialState,
  mortgage: {
    tea: { key: 'tea', label: 'TEA', value: '8.99', suffix: '%', provenance: 'documento', note: '' },
  },
};

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(() => vi.unstubAllGlobals());

describe('App reset control', () => {
  it('is absent with nothing to forget', () => {
    render(<App />);
    expect(screen.queryByRole('button', { name: 'Nueva consulta' })).not.toBeInTheDocument();
  });

  // A schedule read before the first message is something to forget too;
  // the control used to wait for a message that a PDF-only session never sent.
  it('appears once a schedule has been read, before any message', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(withMortgage));
    render(<App />);

    const reset = screen.getByRole('button', { name: 'Nueva consulta' });
    expect(screen.getByLabelText('TEA')).toBeInTheDocument();

    await userEvent.click(reset);
    expect(screen.queryByLabelText('TEA')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nueva consulta' })).not.toBeInTheDocument();
  });
});

describe('property capture journey', () => {
  it('asks without a model call, survives reload, and submits a contextual answer', async () => {
    const user = userEvent.setup();
    const view = render(<App />);
    await user.click(screen.getAllByRole('button', { name: 'Tasa' })[0]!);
    expect(screen.getByText('¿Qué tasa de interés te ofrece el banco? Si la conoces, indica si es TEA o TCEA.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).pendingField).toBe('tasa');
    view.unmount();
    render(<App />);
    const reply = { kind: 'capture', verdict: 'Listo, agregué la tasa.', fields: [{ key: 'tasa', label: 'Tasa', value: '8', suffix: '%', provenance: 'user', note: '' }], metrics: [], scenarios: [], sources: [], prose: [], followUps: [] };
    fetchMock.mockResolvedValue(new Response(`event: envelope\ndata: ${JSON.stringify({ envelope: reply })}\n\n`));
    await user.type(screen.getByRole('textbox'), '8%');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    await waitFor(() => expect(screen.getByText('Listo, agregué la tasa.')).toBeInTheDocument());
    const request = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(request.messages.at(-1)).toEqual({ role: 'user', content: 'Tasa: 8%' });
    expect(screen.queryByText('Análisis', { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText('Qué pasa si mueves una palanca')).not.toBeInTheDocument();
  });
});

it.each([true, false])('retries recalculation after analysis with metrics=%s', async (withMetrics) => {
  const user = userEvent.setup();
  const { initialState } = await import('./state/chatReducer');
  const price = { key: 'precio', label: 'Precio', value: '300,000', provenance: 'user', note: '' };
  const base = { fields: [], metrics: [], scenarios: [], sources: [], prose: [], followUps: [] };
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...initialState,
    fields: { precio: { ...price, value: '350,000' } }, baseline: { precio: '300,000' }, userEdited: ['precio'],
    messages: [
      { id: '1', role: 'user', content: 'Evalúa la inversión' },
      { id: '2', role: 'assistant', envelope: { ...base, kind: 'analysis', verdict: 'Cuota de referencia', metrics: withMetrics ? [{ label: 'Cuota', value: 'S/ 2,000', delta: null, context: '' }] : [] } },
      { id: '3', role: 'user', content: 'Precio: 350,000' },
      { id: '4', role: 'assistant', envelope: { ...base, kind: 'capture', verdict: 'Precio registrado.' } },
    ],
  }));
  fetchMock.mockResolvedValue(new Response('event: error\ndata: {"kind":"api","message":"Error de prueba"}\n\n'));
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Recalcular' }));
  const firstRequest = JSON.parse(fetchMock.mock.calls[0]![1].body);
  await waitFor(() => expect(screen.getByRole('button', { name: /Reintentar/ })).toBeInTheDocument());
  fetchMock.mockResolvedValue(new Response(`event: envelope\ndata: ${JSON.stringify({ envelope: { ...base, kind: 'analysis', verdict: 'Análisis actualizado.' } })}\n\n`));
  await user.click(screen.getByRole('button', { name: /Reintentar/ }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(JSON.parse(fetchMock.mock.calls[1]![1].body).messages).toEqual(firstRequest.messages);
});
