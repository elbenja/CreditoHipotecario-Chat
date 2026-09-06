import { initialState, type ChatState } from './chatReducer';

export const STORAGE_KEY = 'chat-ia-draft-v1';

/**
 * Transient fields are never persisted: restoring a page mid-"analyzing" would
 * show a spinner for a request that is not in flight.
 */
type Persisted = Omit<ChatState, 'status' | 'analyzeSteps' | 'error'>;

function isPlausible(value: unknown): value is Persisted {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.messages) &&
    Array.isArray(v.savedScenarios) &&
    Array.isArray(v.userEdited) &&
    typeof v.fields === 'object' &&
    v.fields !== null
  );
}

export function loadState(): ChatState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed: unknown = JSON.parse(raw);
    if (!isPlausible(parsed)) return initialState;
    return { ...initialState, ...parsed, status: 'idle', analyzeSteps: [], error: null };
  } catch {
    // Corrupt data, or storage blocked entirely. Start clean rather than crash.
    return initialState;
  }
}

export function saveState(state: ChatState): void {
  try {
    const { status: _s, analyzeSteps: _a, error: _e, ...persisted } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // Quota exceeded or storage blocked. A lost draft is bad; a crash is worse.
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do.
  }
}
