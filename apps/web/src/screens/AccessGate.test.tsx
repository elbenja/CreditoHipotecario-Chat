import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAccessToken, lockAccess } from '../api/access';
import { AccessGate } from './AccessGate';

function stubFetch(status: number, body: unknown = {}) {
  const fn = vi.fn(async () => ({ status, ok: status >= 200 && status < 300, json: async () => body }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

async function submit(password: string) {
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /unlock/i }));
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  lockAccess();
});

describe('AccessGate', () => {
  it('shows the error for a wrong password and keeps the app locked', async () => {
    stubFetch(401);
    render(<AccessGate />);
    await submit('nope');
    expect(screen.getByRole('alert')).toHaveTextContent('Incorrect password');
    expect(getAccessToken()).toBeNull();
  });

  it('clears the error as soon as the user types again', async () => {
    stubFetch(401);
    render(<AccessGate />);
    await submit('nope');
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'nop' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('confirms, then opens the app after the delay', async () => {
    vi.useFakeTimers();
    const fetch = stubFetch(200, { token: 'tok' });
    render(<AccessGate />);
    await submit('dito');
    expect(fetch).toHaveBeenCalledWith('/api/unlock', expect.objectContaining({ body: JSON.stringify({ password: 'dito' }) }));
    expect(screen.getByRole('status')).toHaveTextContent('Access granted');
    expect(getAccessToken()).toBeNull();
    act(() => vi.advanceTimersByTime(900));
    expect(getAccessToken()).toBe('tok');
  });

  it('says so when the server is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    render(<AccessGate />);
    await submit('dito');
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't reach the server");
  });
});
