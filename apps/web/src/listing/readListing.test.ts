import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Action } from '../state/chatReducer';
import { streamChat } from '../api/streamChat';
import { readListing } from './readListing';

vi.mock('../api/streamChat', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/streamChat')>();
  return { ...actual, streamChat: vi.fn() };
});

const URL_OK = 'https://nexoinmobiliario.pe/departamentos/barranco/aspiria-1631';

describe('readListing', () => {
  // Block body, not a concise arrow: `mockReset()` returns the mock itself
  // (callable), and an implicit return from beforeEach is treated by Vitest
  // as a teardown hook — it would get invoked with no arguments after each
  // test, calling that test's own onEvent handler with `undefined`.
  beforeEach(() => {
    vi.mocked(streamChat).mockReset();
  });

  it('starts a progress row named after the host with no size, and sends the URL as the listing', async () => {
    vi.mocked(streamChat).mockResolvedValue(undefined);
    const actions: Action[] = [];
    await readListing(URL_OK, 'nexoinmobiliario.pe', (a) => actions.push(a), []);
    expect(actions[0]).toEqual({ type: 'attachStart', name: 'nexoinmobiliario.pe', size: 0 });
    const body = vi.mocked(streamChat).mock.calls[0]![0];
    expect(body.listing).toEqual({ url: URL_OK });
    expect(body.document).toBeUndefined();
  });

  it('dispatches listingReady on the listing event', async () => {
    vi.mocked(streamChat).mockImplementation(async (_b, onEvent) => {
      onEvent({ event: 'listing', data: { listing: { proyecto: 'A' } } });
    });
    const actions: Action[] = [];
    await readListing(URL_OK, 'nexoinmobiliario.pe', (a) => actions.push(a), []);
    expect(actions.at(-1)).toMatchObject({ type: 'listingReady', listing: { proyecto: 'A' } });
  });

  it("passes the server's listing error kind through, and collapses others to api", async () => {
    vi.mocked(streamChat).mockImplementation(async (_b, onEvent) => {
      onEvent({ event: 'error', data: { kind: 'listing', message: 'no' } });
      onEvent({ event: 'error', data: { kind: 'weird', message: 'no' } });
    });
    const actions: Action[] = [];
    await readListing(URL_OK, 'nexoinmobiliario.pe', (a) => actions.push(a), []);
    const kinds = actions.filter((a) => a.type === 'error').map((a) => (a as { kind: string }).kind);
    expect(kinds).toEqual(['listing', 'api']);
  });
});
