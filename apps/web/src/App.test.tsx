import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('App reset control', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

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
