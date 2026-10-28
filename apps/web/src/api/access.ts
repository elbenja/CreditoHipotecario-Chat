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
