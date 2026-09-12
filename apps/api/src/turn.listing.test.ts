import { describe, expect, it, vi } from 'vitest';
import { ListingFetchError } from './listing/fetchListing.ts';
import { parseChatBody, runTurn } from './turn.ts';

const URL_OK = 'https://nexoinmobiliario.pe/departamentos/barranco/aspiria-1631';
const REPLY = JSON.stringify({
  proyecto: 'ASPIRIA', distrito: 'Barranco',
  modelos: [{ nombre: 'TIPO 7', area: '41.75', precioDesde: '363,906' }], dudosos: [],
});

const body = (url = URL_OK, content: string = url) => ({
  messages: [{ role: 'user' as const, content }],
  fields: [],
  listing: { url },
});

async function collect(
  reply: string,
  fetchListing: (url: string) => Promise<string>,
  callModel = vi.fn(async () => ({ content: reply, truncated: false })),
) {
  const out = [];
  for await (const e of runTurn(parseChatBody(body())!, callModel, fetchListing)) out.push(e);
  return { events: out, callModel };
}

describe('listing body', () => {
  it('accepts a Nexo URL', () => {
    expect(parseChatBody(body())?.listing?.url).toBe(URL_OK);
  });

  it('rejects a URL on another host, so the route answers 400 before any fetch', () => {
    expect(parseChatBody(body('https://urbania.pe/x'))).toBeNull();
    expect(parseChatBody(body('https://nexoinmobiliario.pe.evil.com/x'))).toBeNull();
  });

  it('rejects a non-http(s) scheme even on the allowed host', () => {
    expect(parseChatBody(body('ftp://nexoinmobiliario.pe/x'))).toBeNull();
  });
});

describe('listing turns', () => {
  it('announces the read, fetches, extracts with the document model and emits a listing', async () => {
    const fetchListing = vi.fn(async () => 'Proyecto ASPIRIA');
    const modes: string[] = [];
    const callModel = vi.fn(async (_m: unknown, mode: string) => { modes.push(mode); return { content: REPLY, truncated: false }; });
    const { events } = await collect(REPLY, fetchListing, callModel as never);
    expect(fetchListing).toHaveBeenCalledWith(URL_OK);
    expect(modes).toEqual(['document']);
    expect(events.find((e) => e.event === 'analyzeStep')?.data).toEqual({ label: 'Leyendo el anuncio' });
    const listing = events.find((e) => e.event === 'listing')!;
    expect((listing.data as { listing: { fuente: unknown } }).listing.fuente).toEqual({ host: 'nexoinmobiliario.pe', url: URL_OK });
  });

  it('stamps fuente from the canonical URL even when the request used www.', async () => {
    const wwwUrl = 'https://www.nexoinmobiliario.pe/departamentos/barranco/aspiria-1631';
    const fetchListing = vi.fn(async () => 'Proyecto ASPIRIA');
    const callModel = vi.fn(async () => ({ content: REPLY, truncated: false }));
    const parsed = parseChatBody({ messages: [{ role: 'user', content: wwwUrl }], fields: [], listing: { url: wwwUrl } })!;
    const out = [];
    for await (const e of runTurn(parsed, callModel, fetchListing)) out.push(e);
    expect(fetchListing).toHaveBeenCalledWith(URL_OK);
    const listing = out.find((e) => e.event === 'listing')!;
    expect((listing.data as { listing: { fuente: unknown } }).listing.fuente).toEqual({ host: 'nexoinmobiliario.pe', url: URL_OK });
  });

  it('does not run the out-of-scope guardrail on a link turn', async () => {
    // The message text must actually trip isOutOfScope (see scope.test.ts) —
    // otherwise this test passes whether or not the listing branch still runs
    // before the guardrail. Note: it cannot be the pasted URL itself, since a
    // real Nexo path always contains "departamentos", which itself contains
    // the in-scope keyword "depa" and would suppress the trip.
    const callModel = vi.fn(async () => ({ content: REPLY, truncated: false }));
    const parsed = parseChatBody(body(URL_OK, '¿Me conviene invertir en bitcoin?'))!;
    const out = [];
    for await (const e of runTurn(parsed, callModel, async () => 'x')) out.push(e);
    expect(out.some((e) => e.event === 'envelope')).toBe(false);
    expect(out.some((e) => e.event === 'listing')).toBe(true);
  });

  it('reports a fetch failure as kind listing without calling the model', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { events, callModel } = await collect(REPLY, async () => { throw new ListingFetchError('status'); });
    expect(callModel).not.toHaveBeenCalled();
    const err = events.find((e) => e.event === 'error')!.data as { kind: string; message: string };
    expect(err.kind).toBe('listing');
    expect(err.message).toBe('No pude abrir ese anuncio. Prueba de nuevo o pégame los datos.');
    errorSpy.mockRestore();
  });

  it('reports a non-listing page', async () => {
    const { events } = await collect(JSON.stringify({ proyecto: null, distrito: null, modelos: [] }), async () => 'x');
    const err = events.find((e) => e.event === 'error')!.data as { kind: string; message: string };
    expect(err.kind).toBe('listing');
    expect(err.message).toBe('Esa página no parece un anuncio de un departamento.');
  });

  it('reports an unparsable reply', async () => {
    const { events } = await collect('{"proyecto": ', async () => 'x');
    const err = events.find((e) => e.event === 'error')!.data as { message: string };
    expect(err.message).toBe('No pude leer los datos del anuncio.');
  });

  it('caps the reduced text sent to the model', async () => {
    const big = 'x'.repeat(70_000);
    const callModel = vi.fn(async () => ({ content: REPLY, truncated: false }));
    const out = [];
    for await (const e of runTurn(parseChatBody(body())!, callModel, async () => big)) out.push(e);
    const messages = (callModel.mock.calls as unknown[][])[0]![0] as { content: string }[];
    const sent = messages[0]!.content;
    expect(sent.length).toBeLessThan(62_000);
  });

  it('reports a model failure with the usual api kind', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const callModel = vi.fn(async () => { throw new Error('upstream down'); });
    const { events } = await collect(REPLY, async () => 'x', callModel);
    expect((events.find((e) => e.event === 'error')!.data as { kind: string }).kind).toBe('api');
    errorSpy.mockRestore();
  });
});
