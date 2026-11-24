import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { lockAccess } from './api/access';
import { track } from './analytics';
import { AccessGate } from './screens/AccessGate';
import { initialState } from './state/chatReducer';
import { STORAGE_KEY } from './state/persistence';

vi.mock('./analytics', () => ({ track: vi.fn() }));
const tracked = vi.mocked(track);
const count = (event: string) => tracked.mock.calls.filter(([e]) => e === event).length;

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

const reply = { kind: 'capture', verdict: 'Listo.', fields: [], metrics: [], scenarios: [], sources: [], prose: [], followUps: [] };
const ok = () => new Response(`event: envelope\ndata: ${JSON.stringify({ envelope: reply })}\n\n`);
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  tracked.mockReset();
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  lockAccess();
});

async function ask(user: ReturnType<typeof userEvent.setup>, text: string) {
  // The composer is the one textarea; panel fields are inputs.
  const composer = document.querySelector('textarea')!;
  await user.type(composer, text);
  await user.click(composer.closest('form')?.querySelector('button[aria-label="Enviar"]') ?? screen.getAllByRole('button', { name: 'Enviar' })[0]!);
}

describe('chat-first-question', () => {
  it('counts the first accepted question once, not the follow-ups', async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(async () => ok());
    render(<App />);
    await ask(user, 'Depa de 400 mil');
    await waitFor(() => expect(screen.getByText('Listo.')).toBeInTheDocument());
    await ask(user, 'Y a 25 años?');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(count('chat-first-question')).toBe(1);
  });

  it('does not count again after a failed first question is retried or re-asked', async () => {
    const user = userEvent.setup();
    fetchMock.mockRejectedValue(new TypeError('network'));
    render(<App />);
    await ask(user, 'Depa de 400 mil');
    await user.click(await screen.findByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await ask(user, 'Depa de 400 mil');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(count('chat-first-question')).toBe(1);
  });

  it('does not count again after a reload', async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(async () => ok());
    const first = render(<App />);
    await ask(user, 'Depa de 400 mil');
    await waitFor(() => expect(screen.getByText('Listo.')).toBeInTheDocument());
    first.unmount();
    render(<App />);
    await ask(user, 'Y a 25 años?');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(count('chat-first-question')).toBe(1);
  });

  it('counts again in a new conversation after a reset', async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(async () => ok());
    render(<App />);
    await ask(user, 'Depa de 400 mil');
    await waitFor(() => expect(screen.getByText('Listo.')).toBeInTheDocument());
    await user.click(screen.getAllByRole('button', { name: 'Nueva consulta' })[0]!);
    await ask(user, 'Otro depa');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(count('chat-first-question')).toBe(2);
  });

  it('does not count a refused link, and still counts the question after it', async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(async () => ok());
    render(<App />);
    await ask(user, 'https://example.com/depa');
    expect(count('chat-first-question')).toBe(0);
    await ask(user, 'Depa de 400 mil');
    await ask(user, 'Y a 25 años?');
    expect(count('chat-first-question')).toBe(1);
  });

  it('never sends analytics on render alone', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialState));
    render(<App />);
    expect(tracked).not.toHaveBeenCalled();
  });
});

describe('chat-opened', () => {
  const stub = (status: number, body: unknown) =>
    fetchMock.mockImplementation(async () => ({ status, ok: status < 300, json: async () => body }));

  async function unlock(password: string) {
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /unlock/i })));
  }

  it('counts a successful password unlock once', async () => {
    stub(200, { token: 'tok' });
    render(<AccessGate />);
    await unlock('dito');
    await unlock('dito');
    expect(count('chat-opened')).toBe(1);
  });

  it('does not count a wrong password', async () => {
    stub(401, {});
    render(<AccessGate />);
    await unlock('nope');
    expect(tracked).not.toHaveBeenCalled();
  });

  it('counts a demo start, not an unavailable demo', async () => {
    stub(429, {});
    const view = render(<AccessGate />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Probar la demo' })));
    expect(tracked).not.toHaveBeenCalled();
    view.unmount();
    stub(200, { token: 'demo.a.b', remaining: 6 });
    render(<AccessGate />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Probar la demo' })));
    expect(count('chat-opened')).toBe(1);
  });
});

describe('track payload', () => {
  async function load(endpoint: string) {
    vi.resetModules();
    vi.stubEnv('VITE_GOATCOUNTER_URL', endpoint);
    const real = await vi.importActual<typeof import('./analytics')>('./analytics');
    vi.unstubAllEnvs();
    return real.track;
  }

  it('sends only the fixed path, title and event flag, with no referrer', async () => {
    const send = await load('https://x.goatcounter.com/count');
    send('chat-first-question');
    const [url, init] = fetchMock.mock.calls[0]!;
    const u = new URL(url);
    expect(`${u.origin}${u.pathname}`).toBe('https://x.goatcounter.com/count');
    expect([...u.searchParams.keys()].sort()).toEqual(['e', 'p', 'rnd', 't']);
    expect(u.searchParams.get('p')).toBe('chat-first-question');
    expect(u.searchParams.get('t')).toBe('Chat first question');
    expect(u.searchParams.get('e')).toBe('true');
    expect(init).toMatchObject({ referrerPolicy: 'no-referrer', credentials: 'omit' });
  });

  it('does nothing without an endpoint', async () => {
    const send = await load('');
    send('chat-opened');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('swallows a blocked or failing request', async () => {
    const send = await load('https://x.goatcounter.com/count');
    fetchMock.mockImplementationOnce(() => { throw new TypeError('blocked'); });
    expect(() => send('chat-opened')).not.toThrow();
    fetchMock.mockRejectedValueOnce(new TypeError('blocked'));
    expect(() => send('chat-opened')).not.toThrow();
  });
});
