import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initialState, type ChatState } from './chatReducer';
import { STORAGE_KEY, clearState, loadState, saveState } from './persistence';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
});

const populated: ChatState = {
  ...initialState,
  messages: [{ id: 'm1', role: 'user', content: 'Depa de 250 mil' }],
  fields: {
    tasa: { key: 'tasa', label: 'Tasa TEA', value: '8.0', suffix: '%', provenance: 'user', note: 'n' },
  },
  baseline: { tasa: '8.0' },
  userEdited: ['tasa'],
  savedScenarios: [
    { id: 'amoblado', cause: 'Si lo amueblas', value: '+S/ 250', unit: '/mes', tone: 'good', note: 'Rango.' },
  ],
};

describe('persistence', () => {
  it('returns the initial state when nothing is stored', () => {
    expect(loadState()).toEqual(initialState);
  });

  it('round-trips a populated state', () => {
    saveState(populated);
    const back = loadState();
    expect(back.fields.tasa!.value).toBe('8.0');
    expect(back.savedScenarios[0]!.id).toBe('amoblado');
    expect(back.userEdited).toEqual(['tasa']);
    expect(back.messages).toHaveLength(1);
  });

  it('clears the stored draft', () => {
    saveState(populated);
    clearState();
    expect(loadState()).toEqual(initialState);
  });

  it('never persists transient status', () => {
    saveState({ ...populated, status: 'analyzing' });
    expect(loadState().status).toBe('idle');
  });

  it('never persists analyze steps or errors', () => {
    saveState({
      ...populated,
      analyzeSteps: [{ label: 'x', done: false }],
      error: { kind: 'api', message: 'boom', retry: null },
    });
    const back = loadState();
    expect(back.analyzeSteps).toEqual([]);
    expect(back.error).toBeNull();
  });

  it('never persists an attachment in flight', () => {
    saveState({ ...populated, attachment: { name: 'c.pdf', size: 10 } });
    expect(loadState().attachment).toBeNull();
  });

  it('falls back to the initial state on corrupt JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadState()).toEqual(initialState);
  });

  it('falls back to the initial state when the stored shape is wrong', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: 'nope' }));
    expect(loadState()).toEqual(initialState);
  });

  it('does not throw when localStorage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
    });
    expect(() => saveState(populated)).not.toThrow();
    expect(loadState()).toEqual(initialState);
    expect(() => clearState()).not.toThrow();
  });

  it('never persists pendingListing', () => {
    saveState({ ...initialState, pendingListing: { proyecto: 'A', distrito: 'B', modelos: [], fuente: { host: 'pdf' }, dudosos: [] } });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).not.toHaveProperty('pendingListing');
    expect(loadState().pendingListing).toBeNull();
  });
});
