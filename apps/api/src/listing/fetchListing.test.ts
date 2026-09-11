import { describe, expect, it, vi } from 'vitest';
import { ListingFetchError, fetchListingText, htmlToText } from './fetchListing.ts';

const NEXO = 'https://nexoinmobiliario.pe/departamentos/barranco/aspiria-1631';

function htmlResponse(body: string, init: ResponseInit = {}): Response {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
    ...init,
  });
}

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'none';
  } catch (e) {
    return e instanceof ListingFetchError ? e.code : `unexpected:${String(e)}`;
  }
}

describe('htmlToText', () => {
  it('keeps JSON-LD blocks verbatim and drops other scripts and styles', () => {
    const html = `<html><head><style>.x{color:red}</style>
      <script>window.__x = 1;</script>
      <script type="application/ld+json">{"@type":"Product","name":"ASPIRIA"}</script>
      </head><body><h1>Proyecto ASPIRIA</h1><p>Desde&nbsp;S/&nbsp;363,906 &amp; m&#178;</p><!-- c --></body></html>`;
    const text = htmlToText(html);
    expect(text.split('\n')[0]).toBe('{"@type":"Product","name":"ASPIRIA"}');
    expect(text).toContain('Proyecto ASPIRIA Desde S/ 363,906 & m²');
    expect(text).not.toContain('window.__x');
    expect(text).not.toContain('color:red');
    expect(text).not.toContain('<');
  });

  it('collapses whitespace', () => {
    expect(htmlToText('<p>a</p>\n\n\t<p>b</p>')).toBe('a b');
  });
});

describe('fetchListingText', () => {
  it('refuses a host outside the allowlist without calling fetch', async () => {
    const fetchImpl = vi.fn();
    expect(await codeOf(fetchListingText('https://urbania.pe/x', fetchImpl))).toBe('host');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fetches with redirect: manual and a browser-like user agent', async () => {
    const fetchImpl = vi.fn(async () => htmlResponse('<p>hola</p>'));
    await fetchListingText(NEXO, fetchImpl);
    const calls = fetchImpl.mock.calls as unknown[];
    const init = (calls[0] as unknown[])[1] as RequestInit;
    expect(init.redirect).toBe('manual');
    expect((init.headers as Record<string, string>)['user-agent']).toMatch(/Mozilla/);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('treats a redirect as an error rather than following it', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 302, headers: { location: 'https://evil.example/' } }));
    expect(await codeOf(fetchListingText(NEXO, fetchImpl))).toBe('redirect');
  });

  it('treats a non-200 as an error', async () => {
    const fetchImpl = vi.fn(async () => htmlResponse('nope', { status: 404 }));
    expect(await codeOf(fetchListingText(NEXO, fetchImpl))).toBe('status');
  });

  it('treats a non-HTML content type as an error', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }));
    expect(await codeOf(fetchListingText(NEXO, fetchImpl))).toBe('notHtml');
  });

  it('stops reading past the size cap', async () => {
    const big = 'x'.repeat(2 * 1024 * 1024 + 1);
    const fetchImpl = vi.fn(async () => htmlResponse(big));
    expect(await codeOf(fetchListingText(NEXO, fetchImpl))).toBe('tooLarge');
  });

  it('maps a thrown fetch to network', async () => {
    const fetchImpl = vi.fn(async () => { throw new TypeError('fetch failed'); });
    expect(await codeOf(fetchListingText(NEXO, fetchImpl))).toBe('network');
  });

  it('returns the reduced text on success', async () => {
    const fetchImpl = vi.fn(async () => htmlResponse('<h1>ASPIRIA</h1><script type="application/ld+json">{"a":1}</script>'));
    expect(await fetchListingText(NEXO, fetchImpl)).toBe('{"a":1}\nASPIRIA');
  });

  it('maps a body read error to network', async () => {
    const fetchImpl = vi.fn(async () => new Response(
      new ReadableStream({ start(c) { c.error(new Error('boom')); } }),
      { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }
    ));
    expect(await codeOf(fetchListingText(NEXO, fetchImpl))).toBe('network');
  });
});
