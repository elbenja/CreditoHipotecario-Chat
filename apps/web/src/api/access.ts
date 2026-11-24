/**
 * The token the API hands out for the shared prototype password. The API is
 * the real lock — this only remembers the key so the gate shows once per browser.
 */
const API_BASE = (import.meta.env?.VITE_API_URL ?? '').replace(/\/$/, '');
const KEY = 'dito-access-v1';

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

let token = read();
const listeners = new Set<() => void>();

function set(next: string | null) {
  token = next;
  try {
    if (next) localStorage.setItem(KEY, next);
    else localStorage.removeItem(KEY);
  } catch {
    // Private mode: the token lives for this tab only.
  }
  listeners.forEach((l) => l());
}

export const getAccessToken = () => token;

export function subscribeAccess(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Called when the API answers 401: the password changed or the token is bad. */
export const lockAccess = () => set(null);

export const grantAccess = (next: string) => set(next);

export type UnlockResult = { ok: true; token: string } | { ok: false; reason: 'wrong' | 'network' };

export async function requestUnlock(password: string, fetchImpl: typeof fetch = fetch): Promise<UnlockResult> {
  try {
    const res = await fetchImpl(`${API_BASE}/api/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.status === 401) return { ok: false, reason: 'wrong' };
    if (!res.ok) return { ok: false, reason: 'network' };
    const { token: next } = (await res.json()) as { token: string };
    return { ok: true, token: next };
  } catch {
    return { ok: false, reason: 'network' };
  }
}

/** The public demo hands out its own short-lived tokens, all prefixed. */
export const isDemo = () => token?.startsWith('demo.') ?? false;

export type DemoResult = { ok: true; token: string; remaining: number } | { ok: false; reason: 'unavailable' | 'network' };

export async function requestDemo(fetchImpl: typeof fetch = fetch): Promise<DemoResult> {
  try {
    const res = await fetchImpl(`${API_BASE}/api/demo`, { method: 'POST' });
    // 429: today's demos are used up. 404: the server has the demo off.
    if (res.status === 429 || res.status === 404) return { ok: false, reason: 'unavailable' };
    if (!res.ok) return { ok: false, reason: 'network' };
    const { token: next, remaining } = (await res.json()) as { token: string; remaining: number };
    return { ok: true, token: next, remaining };
  } catch {
    return { ok: false, reason: 'network' };
  }
}

/** Questions the demo token has left, as the API last reported them. */
const REMAINING_KEY = 'dito-demo-remaining-v1';

function readRemaining(): number | null {
  try {
    const stored = localStorage.getItem(REMAINING_KEY);
    return stored === null ? null : Number(stored);
  } catch {
    return null;
  }
}

let remaining = readRemaining();
const remainingListeners = new Set<() => void>();

export const getDemoRemaining = () => remaining;

export function setDemoRemaining(next: number) {
  remaining = next;
  try {
    localStorage.setItem(REMAINING_KEY, String(next));
  } catch {
    // Private mode: the count lives for this tab only.
  }
  remainingListeners.forEach((l) => l());
}

export function subscribeDemoRemaining(listener: () => void) {
  remainingListeners.add(listener);
  return () => remainingListeners.delete(listener);
}
