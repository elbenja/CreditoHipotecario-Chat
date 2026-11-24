import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { streamChat } from '../api/streamChat';
import { PinnedFieldRow } from '../components/PinnedField';
import { TopNav } from '../components/TopNav';
import { describeDirty } from '../components/DirtyBand';
import { getFieldQuestion } from '../state/guidance';
import { getLang, setLang } from '.';

describe('language', () => {
  it('switches from the account menu', async () => {
    render(<TopNav />);
    await userEvent.click(screen.getByRole('button', { name: 'Tu cuenta' }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'English' }));

    expect(getLang()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    // The open menu re-renders in place, now in English.
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeTruthy();
    expect(screen.getByRole('menuitemradio', { name: 'English' }).getAttribute('aria-checked')).toBe('true');
  });

  it('names panel rows by key, so old rows follow the picker', () => {
    setLang('en');
    render(
      <PinnedFieldRow
        field={{ key: 'plazo', label: 'Plazo', value: '20', suffix: 'años', provenance: 'user', note: '' }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Term')).toBeTruthy();
    expect(screen.getByText('years')).toBeTruthy();
  });

  it('writes reducer-side copy in English', () => {
    setLang('en');
    const fields = { tasa: { key: 'tasa' as const, label: 'Tasa', value: '8', provenance: 'user' as const, note: '' } };
    expect(describeDirty(fields, ['tasa'])).toBe('You changed the rate. The numbers above are from before.');
    expect(getFieldQuestion('area')).toBe('How many square meters is the apartment?');
  });

  it('tells the API which language to answer in', async () => {
    setLang('en');
    const fetchImpl = vi.fn(async () => new Response('event: envelope\ndata: {}\n\n', { status: 200 }));
    await streamChat({ messages: [{ role: 'user', content: 'hi' }], fields: [] }, () => {}, fetchImpl as typeof fetch);
    const body = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.lang).toBe('en');
  });
});
