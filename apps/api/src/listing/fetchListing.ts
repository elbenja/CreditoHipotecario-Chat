import { isListingHost } from '@chat/shared';

export const LISTING_TIMEOUT_MS = 10_000;
export const LISTING_MAX_BYTES = 2 * 1024 * 1024;

export type ListingFetchCode = 'host' | 'network' | 'redirect' | 'status' | 'notHtml' | 'tooLarge';

export class ListingFetchError extends Error {
  readonly code: ListingFetchCode;
  constructor(code: ListingFetchCode, message = code) {
    super(message);
    this.name = 'ListingFetchError';
    this.code = code;
  }
}

export type FetchListing = (url: string) => Promise<string>;

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

/**
 * A listing page to the ~11k characters the model needs. JSON-LD blocks are
 * kept verbatim modulo whitespace (runs collapsed to one space so each block
 * sits on one line) and put first: Nexo's `Product` block is the most
 * reliable source for name, district, developer and lowest price.
 */
export function htmlToText(html: string): string {
  const kept: string[] = [];
  let s = html.replace(
    /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi,
    (_, body: string) => {
      const trimmed = body.trim();
      if (trimmed) kept.push(trimmed.replace(/\s+/g, ' '));
      return ' ';
    },
  );
  s = s
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s).replace(/\s+/g, ' ').trim();
  return [...kept, s].filter(Boolean).join('\n');
}

/** Read the body up to the cap; past it, abort rather than buffer on. */
async function readCapped(res: Response): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > LISTING_MAX_BYTES) {
      await reader.cancel();
      throw new ListingFetchError('tooLarge');
    }
    chunks.push(value);
  }
  return new TextDecoder('utf-8').decode(Buffer.concat(chunks));
}

/**
 * The allowed host, reachable by several equivalent URL spellings (`www.`,
 * `http://`, embedded userinfo, an explicit default port). Canonicalises to
 * the one form the allowlist and the fetch below both expect — this also
 * checks the host, so callers get `ListingFetchError('host')` for a
 * disallowed one without a separate check.
 */
export function canonicalListingUrl(url: string): string {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    throw new ListingFetchError('host');
  }
  if (!isListingHost(target.hostname)) throw new ListingFetchError('host');

  target.protocol = 'https:';
  target.hostname = 'nexoinmobiliario.pe';
  target.username = '';
  target.password = '';
  target.port = '';
  return target.toString();
}

/**
 * Fetches one listing page. This endpoint is public, so the allowlist is
 * checked HERE, not only in the browser; a redirect is refused rather than
 * followed off the allowlist; and the body is capped so a bad page cannot
 * pin the process.
 */
export async function fetchListingText(url: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const target = canonicalListingUrl(url);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LISTING_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetchImpl(target, {
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36',
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'es-PE,es;q=0.9',
      },
    });
  } catch {
    clearTimeout(timer);
    throw new ListingFetchError('network');
  }

  try {
    if (res.status >= 300 && res.status < 400) throw new ListingFetchError('redirect');
    if (res.status !== 200) throw new ListingFetchError('status');
    const type = res.headers.get('content-type') ?? '';
    if (!/text\/html|application\/xhtml/i.test(type)) throw new ListingFetchError('notHtml');
    return htmlToText(await readCapped(res));
  } catch (e) {
    if (e instanceof ListingFetchError) throw e;
    throw new ListingFetchError('network');
  } finally {
    clearTimeout(timer);
  }
}
