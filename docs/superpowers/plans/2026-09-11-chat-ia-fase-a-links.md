# Chat IA Fase A — Pegar el link de un anuncio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pasted `nexoinmobiliario.pe` link — or a listing page saved as PDF — is read, its project and models shown in a confirmation modal, and the chosen model's location, price and area pinned into the panel with a new `anuncio` provenance.

**Architecture:** The link travels as a new `listing: { url }` field on `POST /api/chat`; the server re-validates the host against an allowlist, fetches the page with a timeout and size cap, reduces it to text (JSON-LD kept), and runs it through the document model with a listing prompt. `runListingPipeline` validates the reply into a shared `Listing`. The PDF route gains a `tipo` discriminator in its prompt so a saved listing reaches the same pipeline. On the web, `readListing` is a sibling of `attachSchedule`, the `listing` event lands in `pendingListing`, and `ConfirmExtraction` gains an `anuncio` variant with a model picker whose confirm dispatches `confirmListing`.

**Tech Stack:** TypeScript, Node 22 (`--experimental-strip-types`, so every relative import in `apps/api` and `packages/shared` carries its `.ts` extension), Fastify, zod, React 19, Vite, Vitest, Testing Library, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-11-chat-ia-fase-a-links-design.md` — read it first; this plan argues from it.

## Global Constraints

- Allowlist: exactly `nexoinmobiliario.pe` and `www.nexoinmobiliario.pe`. The server never fetches any other host, never follows a redirect (`redirect: 'manual'`), times out at **10 s**, and caps the body at **2 MB**.
- Provenance enum becomes `['user', 'assumed', 'market', 'documento', 'anuncio']`. `anuncio` renders like `documento` (emerald dot) with the legend text **"Lo leí de la página"**.
- A listing fills only `ubicacion`, `precio`, `area`. It never touches `inicial`, `tasa`, `plazo` or anything in `mortgage`.
- Every user-facing string is Spanish; none comes from an SDK. Pinned data survives every failure. Copy is verbatim from the spec's Errors table.
- Tests must bite: after a test goes green, break the implementation, watch the test fail, restore it. Each task says where.
- Baseline before Task 1: 433 tests (shared 53, API 166, web 214), `pnpm -r typecheck` clean, `pnpm --filter @chat/web build` clean. Run `pnpm -r test` from the repo root.
- Branch: `fase-a-links` (already exists, off `main` at `05e38dd`, carrying the spec and the handoff). Commit after every task; never push `main`.
- The five real bank PDFs and any real Urbania page are **not** committed. Fixtures are reduced text only.

---

## File map

| File | Responsibility |
|---|---|
| `packages/shared/src/envelope.ts` (modify) | `anuncio` in `ProvenanceSchema` |
| `packages/shared/src/listing.ts` (create) | `ListingSchema`, `ListingModel`, allowlist, `findListingUrl`, `isListingHost`, `listingRefusal`, `listingToFields` — pure, shared by API and web |
| `packages/shared/src/listing.test.ts` (create) | tests for the above |
| `packages/shared/src/index.ts` (modify) | export `listing.ts` |
| `apps/api/src/listing/fetchListing.ts` (create) | `htmlToText`, `fetchListingText` — allowlist, timeout, redirect, size cap |
| `apps/api/src/listing/fetchListing.test.ts` (create) | |
| `apps/api/src/prompt.ts` (modify) | `LISTING_FIELDS_BLOCK`, `LISTING_PROMPT`, `buildListingMessages`, `DOCUMENT_PROMPT` with `tipo`, `renderFields` mentions `anuncio` |
| `apps/api/src/pipeline/listing.ts` (create) | `runListingPipeline(raw, fuente)` |
| `apps/api/src/pipeline/listing.test.ts` (create) | |
| `apps/api/src/pipeline/document.ts` (modify) | dispatch on `tipo`; `DocumentResult` gains `kind` |
| `apps/api/src/turn.ts` (modify) | `listing` in body schema; listing branch; PDF branch handles `anuncio` |
| `apps/api/src/routes/chat.ts` (modify) | optional `fetchListing` dep |
| `apps/api/scripts/make-listing-fixture.ts` (create) | fetch one Nexo page → reduced text fixture |
| `apps/api/test/fixtures/nexo-aspiria.txt`, `nexo-single.txt` (create) | reduced listing text |
| `apps/web/src/state/chatReducer.ts` (modify) | `pendingListing`, `assistant-note`, `refuseListing`, `listingReady`, `confirmListing`, `cancelListing`, `anuncio` kept through `envelope`, error kind `listing` |
| `apps/web/src/state/persistence.ts` (modify) | never persist `pendingListing` |
| `apps/web/src/state/guidance.ts` (modify) | `toTurns` maps `assistant-note` |
| `apps/web/src/api/streamChat.ts` (modify) | `listing` on the request; `listing` is a terminal event |
| `apps/web/src/listing/readListing.ts` (create) | sibling of `pdf/attachSchedule.ts` |
| `apps/web/src/App.tsx` (modify) | `send` routes a URL |
| `apps/web/src/components/ConfirmExtraction.tsx` (modify) | `anuncio` variant with model picker |
| `apps/web/src/components/PinnedField.tsx`, `PinnedPanel.tsx` (modify) | `anuncio` dot and legend |
| `apps/web/src/components/UploadingRow.tsx` (modify) | link mode when `size === 0` |
| `apps/web/src/components/ErrorNotice.tsx` (modify) | title for `listing` |
| `apps/web/src/screens/Conversation.tsx` (modify) | render `assistant-note`; mount the `anuncio` modal |
| `docs/HANDOFF.md` (modify) | record Fase A |

---

### Task 1: Shared listing model and URL helpers

**Files:**
- Modify: `packages/shared/src/envelope.ts:12`
- Create: `packages/shared/src/listing.ts`
- Create: `packages/shared/src/listing.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: `ProvenanceSchema`, `PinnedField` from `envelope.ts`; `groupFieldValue` from `format.ts`.
- Produces (every later task imports these from `@chat/shared`):
  - `LISTING_HOSTS: readonly ['nexoinmobiliario.pe', 'www.nexoinmobiliario.pe']`
  - `ListingModelSchema`, `ListingSchema`, `ListingExtractionSchema`; types `ListingModel`, `Listing`, `ListingExtraction`
  - `findListingUrl(text: string): { url: string; host: string } | null`
  - `isListingHost(host: string): boolean`
  - `listingRefusal(host: string): string`
  - `listingToFields(listing: Listing, model: ListingModel | null): PinnedField[]`

- [ ] **Step 1: Add `anuncio` to the provenance enum**

In `packages/shared/src/envelope.ts` replace the line

```ts
export const ProvenanceSchema = z.enum(['user', 'assumed', 'market', 'documento']);
```

with

```ts
// 'anuncio': read from a third party's listing page — firm, but neither the
// user's word nor the bank's document, and the developer can change it tomorrow.
export const ProvenanceSchema = z.enum(['user', 'assumed', 'market', 'documento', 'anuncio']);
```

- [ ] **Step 2: Write the failing tests**

Create `packages/shared/src/listing.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  ListingSchema,
  findListingUrl,
  isListingHost,
  listingRefusal,
  listingToFields,
  type Listing,
} from './listing.ts';

const ASPIRIA: Listing = {
  proyecto: 'ASPIRIA',
  constructora: 'GRUPO T&C',
  direccion: 'Av. El Sol Este 530',
  distrito: 'Barranco',
  entrega: 'febrero 2027',
  etapa: 'En construcción',
  modelos: [
    { nombre: 'TIPO 3', area: '82.96', precioDesde: '664,806', dormitorios: '3' },
    { nombre: 'TIPO 7', area: '41.75', precioDesde: '363,906', dormitorios: '1' },
  ],
  fuente: { host: 'nexoinmobiliario.pe', url: 'https://nexoinmobiliario.pe/departamentos/barranco/aspiria-1631' },
  dudosos: [],
};

describe('findListingUrl', () => {
  it('takes the first URL in a message and lowercases its host', () => {
    const r = findListingUrl('mira este https://WWW.NexoInmobiliario.pe/departamentos/barranco/aspiria-1631 y este https://urbania.pe/x');
    expect(r).toEqual({
      url: 'https://WWW.NexoInmobiliario.pe/departamentos/barranco/aspiria-1631',
      host: 'www.nexoinmobiliario.pe',
    });
  });

  it('returns null when there is no URL', () => {
    expect(findListingUrl('depa de 300 mil en Barranco')).toBeNull();
  });

  it('ignores a scheme-less domain — only http(s) URLs count', () => {
    expect(findListingUrl('nexoinmobiliario.pe/algo')).toBeNull();
  });
});

describe('isListingHost', () => {
  it('accepts the two Nexo hosts only', () => {
    expect(isListingHost('nexoinmobiliario.pe')).toBe(true);
    expect(isListingHost('www.nexoinmobiliario.pe')).toBe(true);
    expect(isListingHost('urbania.pe')).toBe(false);
  });

  it('rejects look-alike hosts', () => {
    expect(isListingHost('nexoinmobiliario.pe.evil.com')).toBe(false);
    expect(isListingHost('evil.nexoinmobiliario.pe')).toBe(false);
    expect(isListingHost('nexoinmobiliario.pe.')).toBe(false);
  });
});

describe('listingRefusal', () => {
  it('names the host and offers the PDF route', () => {
    expect(listingRefusal('urbania.pe')).toBe(
      'De urbania.pe no puedo leer el anuncio. Pégame los datos o el link de Nexo — o guarda la página como PDF y súbela aquí.',
    );
  });
});

describe('ListingSchema', () => {
  it('tolerates null optionals and numeric dormitorios', () => {
    const parsed = ListingSchema.parse({
      proyecto: 'X', constructora: null, direccion: null, distrito: 'Lince', entrega: null, etapa: null,
      modelos: [{ nombre: null, area: '55', precioDesde: 'S/ 300,000', dormitorios: 2 }],
      fuente: { host: 'pdf' },
    });
    expect(parsed.constructora).toBeUndefined();
    expect(parsed.modelos[0]!.nombre).toBeUndefined();
    expect(parsed.modelos[0]!.dormitorios).toBe('2');
    expect(parsed.dudosos).toEqual([]);
  });
});

describe('listingToFields', () => {
  it('maps a chosen model to ubicacion, precio and area with anuncio provenance', () => {
    const f = Object.fromEntries(listingToFields(ASPIRIA, ASPIRIA.modelos[0]!).map((x) => [x.key, x]));
    expect(Object.keys(f).sort()).toEqual(['area', 'precio', 'ubicacion']);
    expect(f.ubicacion!.value).toBe('Av. El Sol Este 530, Barranco');
    expect(f.ubicacion!.provenance).toBe('anuncio');
    expect(f.ubicacion!.note).toBe('Proyecto ASPIRIA · GRUPO T&C · entrega febrero 2027');
    expect(f.precio!.value).toBe('664,806');
    expect(f.precio!.prefix).toBe('S/');
    expect(f.precio!.note).toBe("Precio 'desde' del modelo TIPO 3");
    expect(f.area!.value).toBe('82.96');
    expect(f.area!.suffix).toBe('m²');
  });

  it('strips a currency or unit the model folded into the value, and groups a bare integer', () => {
    const listing: Listing = {
      ...ASPIRIA,
      modelos: [{ nombre: undefined, area: '55.00 m²', precioDesde: 'S/ 300000', dormitorios: undefined }],
    };
    const f = Object.fromEntries(listingToFields(listing, listing.modelos[0]!).map((x) => [x.key, x]));
    expect(f.precio!.value).toBe('300,000');
    expect(f.precio!.note).toBe('Precio del anuncio');
    expect(f.area!.value).toBe('55.00');
  });

  it('does not repeat the district when the address already ends with it', () => {
    const listing: Listing = { ...ASPIRIA, direccion: 'Av. El Sol Este 530, Barranco' };
    const f = listingToFields(listing, listing.modelos[0]!).find((x) => x.key === 'ubicacion')!;
    expect(f.value).toBe('Av. El Sol Este 530, Barranco');
  });

  it('with no model, pins only ubicacion', () => {
    const keys = listingToFields(ASPIRIA, null).map((x) => x.key);
    expect(keys).toEqual(['ubicacion']);
  });

  it('demotes a field the model listed as dudoso', () => {
    const listing: Listing = { ...ASPIRIA, dudosos: ['precioDesde', 'distrito'] };
    const f = Object.fromEntries(listingToFields(listing, listing.modelos[0]!).map((x) => [x.key, x]));
    expect(f.precio!.provenance).toBe('assumed');
    expect(f.ubicacion!.provenance).toBe('assumed');
    expect(f.area!.provenance).toBe('anuncio');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @chat/shared test -- listing`
Expected: FAIL — `Cannot find module './listing.ts'`.

- [ ] **Step 4: Write `packages/shared/src/listing.ts`**

```ts
import { z } from 'zod';
import type { PinnedField } from './envelope.ts';
import { groupFieldValue } from './format.ts';

/** The only hosts the server will ever fetch. Urbania sits behind a
 *  Cloudflare Managed Challenge (verified 2026-09-10/11) and is out. */
export const LISTING_HOSTS = ['nexoinmobiliario.pe', 'www.nexoinmobiliario.pe'] as const;

// The model sends absent or explicit null interchangeably; both mean "not
// stated". Same tolerance PinnedField already has.
const optionalText = z
  .string()
  .nullish()
  .transform((v) => (v?.trim() ? v.trim() : undefined));

export const ListingModelSchema = z.object({
  nombre: optionalText,
  area: optionalText,
  precioDesde: optionalText,
  // Models emit "3" and 3 interchangeably.
  dormitorios: z
    .union([z.string(), z.number()])
    .nullish()
    .transform((v) => (v === null || v === undefined || v === '' ? undefined : String(v))),
});

/** What the extraction prompt asks the model to answer with. No `fuente`:
 *  the server knows where the text came from; the model does not. */
export const ListingExtractionSchema = z.object({
  proyecto: z.string().trim().min(1),
  constructora: optionalText,
  direccion: optionalText,
  distrito: z.string().trim().min(1),
  entrega: optionalText,
  etapa: optionalText,
  modelos: z.array(ListingModelSchema).default([]),
  /** Fields the model did not read with confidence. Load-bearing, as in Fase B. */
  dudosos: z.array(z.string()).default([]),
});

export const ListingSchema = ListingExtractionSchema.extend({
  fuente: z.object({ host: z.string().min(1), url: z.string().optional() }),
});

export type ListingModel = z.infer<typeof ListingModelSchema>;
export type ListingExtraction = z.infer<typeof ListingExtractionSchema>;
export type Listing = z.infer<typeof ListingSchema>;

/** The first http(s) URL in a message, with its host lowercased. */
export function findListingUrl(text: string): { url: string; host: string } | null {
  const m = /https?:\/\/[^\s<>"']+/i.exec(text);
  if (!m) return null;
  try {
    return { url: m[0], host: new URL(m[0]).hostname.toLowerCase() };
  } catch {
    return null;
  }
}

export function isListingHost(host: string): boolean {
  return (LISTING_HOSTS as readonly string[]).includes(host.toLowerCase());
}

export function listingRefusal(host: string): string {
  return `De ${host} no puedo leer el anuncio. Pégame los datos o el link de Nexo — o guarda la página como PDF y súbela aquí.`;
}

/** Remove a unit the model folded into the value despite the prompt. */
function bare(raw: string, kind: 'soles' | 'm2'): string {
  let v = raw.trim();
  if (kind === 'soles') v = v.replace(/^S\/\.?\s*/i, '').replace(/^desde\s+/i, '').replace(/^S\/\.?\s*/i, '');
  else v = v.replace(/\s*m\s*(²|2)\s*$/i, '');
  return groupFieldValue(v.trim());
}

/**
 * The property half of the panel, from a listing and the model the user
 * chose. `null` model — the user has not chosen yet — pins the location only.
 * A key in `dudosos` arrives `assumed`, never `anuncio`: the same rule that
 * keeps a misread digit from presenting as read-from-the-bank.
 */
export function listingToFields(listing: Listing, model: ListingModel | null): PinnedField[] {
  const dudosos = new Set(listing.dudosos);
  const out: PinnedField[] = [];

  const distrito = listing.distrito.trim();
  const direccion = listing.direccion?.trim();
  const ubicacion =
    direccion && !direccion.toLowerCase().endsWith(distrito.toLowerCase())
      ? `${direccion}, ${distrito}`
      : (direccion ?? distrito);
  out.push({
    key: 'ubicacion',
    label: 'Ubicación',
    value: ubicacion,
    prefix: undefined,
    suffix: undefined,
    provenance: dudosos.has('distrito') || dudosos.has('direccion') ? 'assumed' : 'anuncio',
    note: [
      `Proyecto ${listing.proyecto}`,
      listing.constructora,
      listing.entrega ? `entrega ${listing.entrega}` : undefined,
    ]
      .filter(Boolean)
      .join(' · '),
  });

  if (!model) return out;

  if (model.precioDesde) {
    const value = bare(model.precioDesde, 'soles');
    if (value) {
      out.push({
        key: 'precio',
        label: 'Precio',
        value,
        prefix: 'S/',
        suffix: undefined,
        provenance: dudosos.has('precioDesde') ? 'assumed' : 'anuncio',
        note: model.nombre ? `Precio 'desde' del modelo ${model.nombre}` : 'Precio del anuncio',
      });
    }
  }

  if (model.area) {
    const value = bare(model.area, 'm2');
    if (value) {
      out.push({
        key: 'area',
        label: 'Área',
        value,
        prefix: undefined,
        suffix: 'm²',
        provenance: dudosos.has('area') ? 'assumed' : 'anuncio',
        note: '',
      });
    }
  }

  return out;
}
```

- [ ] **Step 5: Export it**

In `packages/shared/src/index.ts` add:

```ts
export * from './listing.ts';
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm --filter @chat/shared test`
Expected: all pass (53 + the new ones).

- [ ] **Step 7: Make a test bite**

In `isListingHost`, temporarily change `.includes(host.toLowerCase())` to `.some((h) => host.toLowerCase().includes(h))`. Run `pnpm --filter @chat/shared test -- listing`. Expected: "rejects look-alike hosts" FAILS (`nexoinmobiliario.pe.evil.com` passes). Restore the original line and re-run: PASS.

- [ ] **Step 8: Typecheck and commit**

Run: `pnpm -r typecheck` — expected clean (nothing consumes `anuncio` yet).

```bash
git add packages/shared/src/envelope.ts packages/shared/src/listing.ts packages/shared/src/listing.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): listing schema, allowlist and field mapping for Fase A

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Fetch a listing page safely and reduce it to text

**Files:**
- Create: `apps/api/src/listing/fetchListing.ts`
- Create: `apps/api/src/listing/fetchListing.test.ts`

**Interfaces:**
- Consumes: `isListingHost` from `@chat/shared`.
- Produces:
  - `htmlToText(html: string): string` — JSON-LD blocks first (verbatim, one per line), then the page text with tags stripped, entities decoded, whitespace collapsed.
  - `class ListingFetchError extends Error { code: 'host' | 'network' | 'redirect' | 'status' | 'notHtml' | 'tooLarge' }`
  - `fetchListingText(url: string, fetchImpl?: typeof fetch): Promise<string>` — throws `ListingFetchError`.
  - `type FetchListing = (url: string) => Promise<string>`
  - Constants `LISTING_TIMEOUT_MS = 10_000`, `LISTING_MAX_BYTES = 2 * 1024 * 1024`.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/listing/fetchListing.test.ts`:

```ts
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
    const init = fetchImpl.mock.calls[0]![1] as RequestInit;
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
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @chat/api test -- fetchListing`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `apps/api/src/listing/fetchListing.ts`**

```ts
import { isListingHost } from '@chat/shared';

export const LISTING_TIMEOUT_MS = 10_000;
export const LISTING_MAX_BYTES = 2 * 1024 * 1024;

export type ListingFetchCode = 'host' | 'network' | 'redirect' | 'status' | 'notHtml' | 'tooLarge';

export class ListingFetchError extends Error {
  constructor(public readonly code: ListingFetchCode, message = code) {
    super(message);
    this.name = 'ListingFetchError';
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
 * kept verbatim and put first: Nexo's `Product` block is the most reliable
 * source for name, district, developer and lowest price.
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
 * Fetches one listing page. This endpoint is public, so the allowlist is
 * checked HERE, not only in the browser; a redirect is refused rather than
 * followed off the allowlist; and the body is capped so a bad page cannot
 * pin the process.
 */
export async function fetchListingText(url: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    throw new ListingFetchError('host');
  }
  if (!isListingHost(host)) throw new ListingFetchError('host');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LISTING_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetchImpl(url, {
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
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @chat/api test -- fetchListing`
Expected: PASS.

- [ ] **Step 5: Make a test bite**

Change `redirect: 'manual'` to `redirect: 'follow'` and run the file. Expected: "fetches with redirect: manual…" FAILS. Restore, re-run: PASS. Then change `if (total > LISTING_MAX_BYTES)` to `if (false)`; expected: "stops reading past the size cap" FAILS. Restore, re-run: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/listing
git commit -m "feat(api): fetch a Nexo listing behind an allowlist, timeout and size cap

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Listing prompt and pipeline

**Files:**
- Modify: `apps/api/src/prompt.ts` (append after `buildDocumentMessages`)
- Create: `apps/api/src/pipeline/listing.ts`
- Create: `apps/api/src/pipeline/listing.test.ts`
- Modify: `apps/api/src/prompt.test.ts` (append)

**Interfaces:**
- Consumes: `ListingExtractionSchema`, `ListingSchema`, `Listing` from `@chat/shared`; `ChatMessage` from `prompt.ts`.
- Produces:
  - `LISTING_FIELDS_BLOCK: string` — the JSON shape + rules, reused by Task 4's document prompt.
  - `LISTING_PROMPT: string`
  - `buildListingMessages(text: string): ChatMessage[]`
  - `type ListingResult = { ok: true; listing: Listing } | { ok: false; reason: 'unparsable' | 'notListing' }`
  - `runListingPipeline(raw: string, fuente: { host: string; url?: string }): ListingResult`

- [ ] **Step 1: Write the failing pipeline tests**

Create `apps/api/src/pipeline/listing.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { runListingPipeline } from './listing.ts';

const FUENTE = { host: 'nexoinmobiliario.pe', url: 'https://nexoinmobiliario.pe/departamentos/barranco/aspiria-1631' };

const FULL = JSON.stringify({
  proyecto: 'ASPIRIA', constructora: 'GRUPO T&C', direccion: 'Av. El Sol Este 530', distrito: 'Barranco',
  entrega: '28 de Febrero, 2027', etapa: 'En construcción',
  modelos: [
    { nombre: 'TIPO 3', area: '82.96', precioDesde: '664,806', dormitorios: 3 },
    { nombre: 'TIPO 7', area: '41.75', precioDesde: '363,906', dormitorios: 1 },
  ],
  dudosos: [],
});

function listingOf(raw: string) {
  const r = runListingPipeline(raw, FUENTE);
  if (!r.ok) throw new Error(`expected ok, got ${r.reason}`);
  return r.listing;
}

describe('runListingPipeline', () => {
  it('turns a full extraction into a listing carrying its source', () => {
    const l = listingOf(FULL);
    expect(l.proyecto).toBe('ASPIRIA');
    expect(l.modelos).toHaveLength(2);
    expect(l.modelos[0]!.dormitorios).toBe('3');
    expect(l.fuente).toEqual(FUENTE);
  });

  it('strips markdown fences the model sometimes adds', () => {
    expect(runListingPipeline('```json\n' + FULL + '\n```', FUENTE).ok).toBe(true);
  });

  it('ignores a tipo discriminator when the reply carries one (shared with the PDF route)', () => {
    const raw = JSON.stringify({ ...JSON.parse(FULL), tipo: 'anuncio' });
    expect(runListingPipeline(raw, FUENTE).ok).toBe(true);
  });

  it('reports unparsable on broken JSON', () => {
    expect(runListingPipeline('{"proyecto": ', FUENTE)).toEqual({ ok: false, reason: 'unparsable' });
  });

  it('reports notListing when the model says tipo otro', () => {
    expect(runListingPipeline(JSON.stringify({ tipo: 'otro' }), FUENTE)).toEqual({ ok: false, reason: 'notListing' });
  });

  it('reports notListing when there is no district', () => {
    const raw = JSON.stringify({ ...JSON.parse(FULL), distrito: null });
    expect(runListingPipeline(raw, FUENTE)).toEqual({ ok: false, reason: 'notListing' });
  });

  it('reports notListing when no model carries a price or an area', () => {
    const raw = JSON.stringify({ ...JSON.parse(FULL), modelos: [{ nombre: 'X' }] });
    expect(runListingPipeline(raw, FUENTE)).toEqual({ ok: false, reason: 'notListing' });
    const empty = JSON.stringify({ ...JSON.parse(FULL), modelos: [] });
    expect(runListingPipeline(empty, FUENTE)).toEqual({ ok: false, reason: 'notListing' });
  });

  it('drops models with neither price nor area but keeps the rest', () => {
    const raw = JSON.stringify({
      ...JSON.parse(FULL),
      modelos: [{ nombre: 'X' }, { nombre: 'TIPO 7', area: '41.75', precioDesde: '363,906' }],
    });
    expect(listingOf(raw).modelos.map((m) => m.nombre)).toEqual(['TIPO 7']);
  });
});
```

- [ ] **Step 2: Write the failing prompt tests**

Append to `apps/api/src/prompt.test.ts`:

```ts
import { LISTING_PROMPT, buildListingMessages } from './prompt.ts';

describe('buildListingMessages', () => {
  it('sends the listing prompt and the page text as one user turn', () => {
    const [m] = buildListingMessages('{"@type":"Product"}\nProyecto ASPIRIA');
    expect(m!.role).toBe('user');
    expect(m!.content).toContain(LISTING_PROMPT);
    expect(m!.content).toContain('Proyecto ASPIRIA');
  });

  it('asks for the listing shape and tells the model JSON-LD is the most reliable source', () => {
    expect(LISTING_PROMPT).toContain('"modelos"');
    expect(LISTING_PROMPT).toContain('"precioDesde"');
    expect(LISTING_PROMPT).toMatch(/ld\+json|JSON-LD/);
    expect(LISTING_PROMPT).toContain('"dudosos"');
  });
});
```

(If `prompt.test.ts` already imports from `./prompt.ts`, merge the names into that import instead of adding a second one.)

- [ ] **Step 3: Run both files to verify they fail**

Run: `pnpm --filter @chat/api test -- listing prompt`
Expected: FAIL — `./listing.ts` not found; `LISTING_PROMPT` not exported.

- [ ] **Step 4: Add the prompt**

Append to `apps/api/src/prompt.ts`:

```ts
/**
 * The listing shape, shared by the link route and the PDF route's "anuncio"
 * branch so a saved Urbania page and a fetched Nexo page extract identically.
 */
export const LISTING_FIELDS_BLOCK = `{"proyecto":"nombre del proyecto o del anuncio","constructora":null,"direccion":null,"distrito":"distrito","entrega":null,"etapa":null,"modelos":[{"nombre":null,"area":null,"precioDesde":null,"dormitorios":null}],"dudosos":[]}

REGLAS DEL ANUNCIO
- "proyecto": el nombre del proyecto (una constructora vende varios modelos) o, si es un solo departamento en reventa, el título del anuncio.
- "direccion": solo la calle y el número, sin el distrito. "distrito": el distrito de Lima o la ciudad. Obligatorio.
- "modelos": UNA entrada por cada modelo o tipología que la página lista con su propio precio o área. Un anuncio de un solo departamento devuelve un solo modelo con "nombre" null.
- "precioDesde": el precio "desde" de ese modelo, en soles, copiado EXACTAMENTE como aparece (con sus comas). Si la página solo trae dólares, copia el monto en dólares y añade "precioDesde" a "dudosos".
- "area": el área en m² de ese modelo, solo el número. "dormitorios": solo el número.
- "etapa": "En planos", "En construcción" o "Entrega inmediata" si la página lo dice. "entrega": la fecha de entrega si la dice.
- Usa null en cada campo que la página no traiga. No inventes.
- "dudosos": los nombres de los campos que NO leíste con certeza ("precioDesde", "area", "distrito", "direccion"…). Es mejor declarar una duda que acertar por casualidad.`;

export const LISTING_PROMPT = `Este es el texto de un anuncio de venta de un departamento o proyecto inmobiliario en el Perú. Si empieza con uno o más bloques JSON-LD (application/ld+json), ese bloque es la fuente más fiable para el nombre, el distrito, la constructora y el precio más bajo; los precios y áreas de cada modelo están en el texto de la página.

Responde ÚNICAMENTE con este JSON, sin texto alrededor y sin bloques de markdown:
${LISTING_FIELDS_BLOCK}

Si el texto no es un anuncio de un departamento, responde {"proyecto":null,"distrito":null,"modelos":[],"dudosos":[]}.`;

export function buildListingMessages(text: string): ChatMessage[] {
  return [{ role: 'user', content: `${LISTING_PROMPT}\n\n---\n${text}` }];
}
```

- [ ] **Step 5: Write `apps/api/src/pipeline/listing.ts`**

```ts
import { ListingExtractionSchema, ListingSchema, type Listing } from '@chat/shared';

export type ListingResult =
  | { ok: true; listing: Listing }
  | { ok: false; reason: 'unparsable' | 'notListing' };

/** Models wrap JSON in fences often enough to handle it rather than fail. */
function stripFences(raw: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/.exec(raw);
  return (fenced?.[1] ?? raw).trim();
}

/**
 * Validates a listing extraction and stamps where it came from. Shared by
 * the link route (fuente = the fetched host and URL) and the PDF route
 * (fuente = { host: 'pdf' }). A `tipo` key, if present, is ignored here —
 * the document pipeline dispatches on it before calling this.
 */
export function runListingPipeline(raw: string, fuente: { host: string; url?: string }): ListingResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch {
    return { ok: false, reason: 'unparsable' };
  }

  if (typeof parsed === 'object' && parsed !== null && (parsed as { tipo?: unknown }).tipo === 'otro') {
    return { ok: false, reason: 'notListing' };
  }

  const result = ListingExtractionSchema.safeParse(parsed);
  // A missing proyecto or distrito is the model's "this is not a listing"
  // answer, not a broken reply.
  if (!result.success) {
    const missingRequired = result.error.issues.some(
      (i) => (i.path[0] === 'proyecto' || i.path[0] === 'distrito') && i.path.length === 1,
    );
    return { ok: false, reason: missingRequired ? 'notListing' : 'unparsable' };
  }

  const modelos = result.data.modelos.filter((m) => m.precioDesde || m.area);
  if (modelos.length === 0) return { ok: false, reason: 'notListing' };

  return { ok: true, listing: ListingSchema.parse({ ...result.data, modelos, fuente }) };
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm --filter @chat/api test -- listing prompt`
Expected: PASS.

- [ ] **Step 7: Make a test bite**

Remove the `.filter((m) => m.precioDesde || m.area)` (use `result.data.modelos` directly). Expected: "drops models with neither price nor area…" and "reports notListing when no model carries…" FAIL. Restore, re-run: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/prompt.ts apps/api/src/prompt.test.ts apps/api/src/pipeline/listing.ts apps/api/src/pipeline/listing.test.ts
git commit -m "feat(api): listing extraction prompt and pipeline

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: The PDF route classifies cronograma vs anuncio

**Files:**
- Modify: `apps/api/src/prompt.ts` — `DOCUMENT_PROMPT`
- Modify: `apps/api/src/pipeline/document.ts`
- Modify: `apps/api/src/pipeline/document.test.ts`
- Modify: `apps/api/src/turn.ts:62-93` (the `if (body.document)` branch)
- Modify: `apps/api/src/turn.document.test.ts`
- Modify: `apps/api/src/prompt.document.test.ts` (only if an assertion pins the old opening line — check)

**Interfaces:**
- Consumes: `runListingPipeline`, `LISTING_FIELDS_BLOCK` from Task 3.
- Produces:
  - `DocumentResult = { ok: true; kind: 'cronograma'; fields: MortgageField[] } | { ok: true; kind: 'anuncio'; listing: Listing } | { ok: false; reason: 'otro' | 'unparsable' }`
  - The `listing` SSE event: `{ event: 'listing', data: { listing: Listing } }` — Task 5 reuses it, Task 8 consumes it.

- [ ] **Step 1: Update the pipeline tests**

In `apps/api/src/pipeline/document.test.ts`:

Change `fieldsOf` to:

```ts
function fieldsOf(raw: string) {
  const r = runDocumentPipeline(raw);
  if (!r.ok) throw new Error(`expected ok, got ${r.reason}`);
  if (r.kind !== 'cronograma') throw new Error(`expected cronograma, got ${r.kind}`);
  return Object.fromEntries(r.fields.map((f) => [f.key, f]));
}
```

Replace the test `'reports noSchedule when nothing readable came back'` body with:

```ts
  it('reports otro when nothing readable came back', () => {
    const r = runDocumentPipeline(JSON.stringify({ dudosos: [] }));
    expect(r).toEqual({ ok: false, reason: 'otro' });
  });
```

Append:

```ts
describe('runDocumentPipeline — tipo dispatch', () => {
  const LISTING = {
    tipo: 'anuncio', proyecto: 'ASPIRIA', distrito: 'Barranco',
    modelos: [{ nombre: 'TIPO 7', area: '41.75', precioDesde: '363,906' }], dudosos: [],
  };

  it('routes tipo anuncio to a listing stamped as read from a PDF', () => {
    const r = runDocumentPipeline(JSON.stringify(LISTING));
    expect(r.ok && r.kind === 'anuncio' && r.listing.fuente).toEqual({ host: 'pdf' });
  });

  it('routes tipo cronograma to mortgage fields', () => {
    const r = runDocumentPipeline(JSON.stringify({ ...JSON.parse(FULL), tipo: 'cronograma' }));
    expect(r.ok && r.kind).toBe('cronograma');
  });

  it('reports otro when the model says so', () => {
    expect(runDocumentPipeline(JSON.stringify({ tipo: 'otro' }))).toEqual({ ok: false, reason: 'otro' });
  });

  it('reports otro for an anuncio with no readable model', () => {
    expect(runDocumentPipeline(JSON.stringify({ ...LISTING, modelos: [] }))).toEqual({ ok: false, reason: 'otro' });
  });

  it('still reads a reply with no tipo as a cronograma (older prompt shape)', () => {
    expect(runDocumentPipeline(FULL).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Update the turn tests**

In `apps/api/src/turn.document.test.ts`, change the assertion in `'emits a document error when the reply is not a schedule'` from `toMatch(/cronograma/i)` to:

```ts
    expect((err!.data as { message: string }).message).toBe(
      'Esto no parece un cronograma ni un anuncio. Revisa que sea la primera página.',
    );
```

Append inside the `describe('document turns')`:

```ts
  it('emits a listing event when the PDF is an anuncio', async () => {
    const events = await collect(
      { messages: [{ role: 'user', content: 'mi anuncio' }], fields: [],
        document: { kind: 'text', text: 'Proyecto ASPIRIA Barranco' } },
      JSON.stringify({
        tipo: 'anuncio', proyecto: 'ASPIRIA', distrito: 'Barranco',
        modelos: [{ nombre: 'TIPO 7', area: '41.75', precioDesde: '363,906' }], dudosos: [],
      }),
    );
    const listing = events.find((e) => e.event === 'listing');
    expect(listing).toBeDefined();
    expect((listing!.data as { listing: { fuente: { host: string } } }).listing.fuente.host).toBe('pdf');
    expect(events.some((e) => e.event === 'extraction')).toBe(false);
  });
```

- [ ] **Step 3: Run to verify they fail**

Run: `pnpm --filter @chat/api test -- document`
Expected: FAIL — `r.kind` undefined, `'otro'` vs `'noSchedule'`, no `listing` event, old message.

- [ ] **Step 4: Rewrite `DOCUMENT_PROMPT`**

In `apps/api/src/prompt.ts`, replace the whole `DOCUMENT_PROMPT` constant (keep the doc comment above it) with:

```ts
export const DOCUMENT_PROMPT = `Esta es la primera página de un documento. Primero decide qué es:
- "cronograma": el cronograma de pagos de un crédito hipotecario de un banco peruano.
- "anuncio": el anuncio de venta de un departamento o de un proyecto inmobiliario (portal, inmobiliaria o constructora), aunque sea una página web guardada como PDF.
- "otro": cualquier otra cosa.

Responde ÚNICAMENTE con un objeto JSON, sin texto alrededor y sin bloques de markdown. El objeto lleva "tipo" y, según el tipo, los campos de abajo.

SI ES UN CRONOGRAMA, responde:
{"tipo":"cronograma","montoFinanciado":null,"cuota":null,"tea":null,"teaTipo":"fija|variable","tcea":null,"plazoCuotas":null,"seguroDesgravamen":null,"seguroInmueble":null,"valorInmueble":null,"totalAPagar":null,"dudosos":[]}

Cada banco nombra lo mismo de forma distinta. Sinónimos:
- montoFinanciado: "Monto Prestamo", "Importe", "IMPORTE CONCEDIDO", "IMPORTE PRESTAMO", "MONTO DE CREDITO"
- cuota: "Total Cuota", "Imp. Cuota", "CUOTA"
- tea: "T.E.A.", "TEA Fija a N dias", "INTERES EFECTIVO ANUAL", "TASA DE INTERES COMPENSATORIA EFECTIVA ANUAL"
- tcea: "T.C.E.A.", "Tasa Costo Efectivo Anual", "COSTO EFECTIVO"
- plazoCuotas: "Nro. de Cuotas", "Nro.Cuotas", "PLAZO TOTAL", "CUOTAS POR PAGAR", "PLAZO"
- seguroDesgravamen: "Tasa Seguro de Desgravamen", "Tasa Desgrav.", "SEG.DESG", "TASA ANUAL SEGURO DESGRAVAMEN"
- seguroInmueble: "Seguro Todo Riesgo", "Tasa de Bien", "SEGURO HIPOTECARIO", "TASA ANUAL SEGURO INMUEBLE"
- valorInmueble: "Monto Asegurado", "Imp. Bien", "valor del bien", "tasación"
- totalAPagar: "Monto Total a Pagar", "TOTALES A PAGAR"

El documento puede venir subrayado, resaltado o con anotaciones a mano. Ignóralas: lee lo impreso.

REGLAS DEL CRONOGRAMA
- Copia las cifras EXACTAMENTE como aparecen, con sus comas y decimales. No las conviertas ni las redondees.
- Usa null en cada campo que el documento no traiga. No inventes.
- "dudosos": la lista de los campos que NO leíste con certeza. Es mejor declarar una duda que acertar por casualidad.

SI ES UN ANUNCIO, responde con "tipo":"anuncio" y estos campos:
${LISTING_FIELDS_BLOCK}

SI ES OTRA COSA, responde {"tipo":"otro"}.`;
```

`LISTING_FIELDS_BLOCK` is declared later in the file than `DOCUMENT_PROMPT`; move the `LISTING_FIELDS_BLOCK` and `LISTING_PROMPT` declarations **above** `DOCUMENT_PROMPT` so the template literal can reference it (a `const` used before its declaration throws at module load).

Run `pnpm --filter @chat/api test -- prompt.document` and fix any assertion that pinned the old first line ("Esta es la primera página de un cronograma") by pointing it at the synonym table instead, e.g. `expect(DOCUMENT_PROMPT).toContain('IMPORTE CONCEDIDO')`. The synonym rows themselves are unchanged and must stay so.

- [ ] **Step 5: Rewrite `runDocumentPipeline`'s result and dispatch**

In `apps/api/src/pipeline/document.ts`:

Replace the imports and `DocumentResult` with:

```ts
import {
  ExtractionSchema,
  MortgageFieldSchema,
  type Extraction,
  type Listing,
  type MortgageField,
  type MortgageKey,
} from '@chat/shared';
import { runListingPipeline } from './listing.ts';

export type DocumentResult =
  | { ok: true; kind: 'cronograma'; fields: MortgageField[] }
  | { ok: true; kind: 'anuncio'; listing: Listing }
  | { ok: false; reason: 'otro' | 'unparsable' };
```

Replace the body of `runDocumentPipeline` from `let parsed: unknown;` through the `ExtractionSchema.safeParse` line with:

```ts
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch {
    return { ok: false, reason: 'unparsable' };
  }

  // The prompt asks for a type first. A reply with no `tipo` is read as a
  // cronograma so an older-shaped answer still extracts.
  const tipo = typeof parsed === 'object' && parsed !== null ? (parsed as { tipo?: unknown }).tipo : undefined;
  if (tipo === 'otro') return { ok: false, reason: 'otro' };
  if (tipo === 'anuncio') {
    const r = runListingPipeline(raw, { host: 'pdf' });
    if (r.ok) return { ok: true, kind: 'anuncio', listing: r.listing };
    return { ok: false, reason: r.reason === 'notListing' ? 'otro' : 'unparsable' };
  }

  const result = ExtractionSchema.safeParse(parsed);
  if (!result.success) return { ok: false, reason: 'unparsable' };
```

And change the last two lines of the function to:

```ts
  // Parsed cleanly but carried nothing: this was not a payment schedule.
  if (fields.length === 0) return { ok: false, reason: 'otro' };
  return { ok: true, kind: 'cronograma', fields };
```

- [ ] **Step 6: Update the document branch in `runTurn`**

In `apps/api/src/turn.ts`, inside `if (body.document) { ... }`, replace the block from `const result = runDocumentPipeline(content);` through the closing of `if (result.ok) {...} else {...}` with:

```ts
      const result = runDocumentPipeline(content);
      yield { event: 'status', data: { phase: 'streaming' } };
      if (result.ok && result.kind === 'cronograma') {
        yield { event: 'extraction', data: { fields: result.fields } };
      } else if (result.ok) {
        yield { event: 'listing', data: { listing: result.listing } };
      } else {
        yield {
          event: 'error',
          data: {
            kind: 'document',
            message:
              result.reason === 'otro'
                ? 'Esto no parece un cronograma ni un anuncio. Revisa que sea la primera página.'
                : 'No pude leer las condiciones de ese documento.',
          },
        };
      }
```

- [ ] **Step 7: Run the API suite**

Run: `pnpm --filter @chat/api test`
Expected: PASS (166 + new). If `prompt.document.test.ts` still fails on the old opening line, fix per Step 4.

- [ ] **Step 8: Make a test bite**

In `runDocumentPipeline`, change `if (tipo === 'anuncio')` to `if (tipo === 'anuncioX')`. Expected: "routes tipo anuncio…" and the turn test "emits a listing event…" FAIL. Restore, re-run: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/prompt.ts apps/api/src/pipeline/document.ts apps/api/src/pipeline/document.test.ts apps/api/src/turn.ts apps/api/src/turn.document.test.ts apps/api/src/prompt.document.test.ts
git commit -m "feat(api): the PDF route tells a cronograma from an anuncio

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: The link route on the server

**Files:**
- Modify: `apps/api/src/turn.ts` — `BodySchema`, `runTurn` signature, new branch
- Modify: `apps/api/src/routes/chat.ts` — `ServerDeps`, pass the fetcher
- Modify: `apps/api/src/prompt.ts` — `renderFields`
- Create: `apps/api/src/turn.listing.test.ts`
- Modify: `apps/api/src/routes/chat.test.ts` (append)
- Modify: `apps/api/src/prompt.test.ts` (append)

**Interfaces:**
- Consumes: `fetchListingText`, `FetchListing`, `ListingFetchError` (Task 2); `buildListingMessages`, `runListingPipeline` (Task 3); `isListingHost` (Task 1).
- Produces:
  - `ChatBody.listing?: { url: string }` — the host must pass `isListingHost` or `parseChatBody` returns `null` (→ 400).
  - `runTurn(body, callModel, fetchListing: FetchListing = fetchListingText)`.
  - `ServerDeps.fetchListing?: FetchListing`.
  - Error event `{ kind: 'listing', message }`.

- [ ] **Step 1: Write the failing turn tests**

Create `apps/api/src/turn.listing.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { ListingFetchError } from './listing/fetchListing.ts';
import { parseChatBody, runTurn } from './turn.ts';

const URL_OK = 'https://nexoinmobiliario.pe/departamentos/barranco/aspiria-1631';
const REPLY = JSON.stringify({
  proyecto: 'ASPIRIA', distrito: 'Barranco',
  modelos: [{ nombre: 'TIPO 7', area: '41.75', precioDesde: '363,906' }], dudosos: [],
});

const body = (url = URL_OK) => ({
  messages: [{ role: 'user' as const, content: url }],
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

  it('does not run the out-of-scope guardrail on a link turn', async () => {
    const { events } = await collect(REPLY, async () => 'x');
    expect(events.some((e) => e.event === 'envelope')).toBe(false);
    expect(events.some((e) => e.event === 'listing')).toBe(true);
  });

  it('reports a fetch failure as kind listing without calling the model', async () => {
    const { events, callModel } = await collect(REPLY, async () => { throw new ListingFetchError('status'); });
    expect(callModel).not.toHaveBeenCalled();
    const err = events.find((e) => e.event === 'error')!.data as { kind: string; message: string };
    expect(err.kind).toBe('listing');
    expect(err.message).toBe('No pude abrir ese anuncio. Prueba de nuevo o pégame los datos.');
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

  it('reports a model failure with the usual api kind', async () => {
    const callModel = vi.fn(async () => { throw new Error('upstream down'); });
    const { events } = await collect(REPLY, async () => 'x', callModel);
    expect((events.find((e) => e.event === 'error')!.data as { kind: string }).kind).toBe('api');
  });
});
```

- [ ] **Step 2: Write the failing route and prompt tests**

Append to `apps/api/src/routes/chat.test.ts`:

```ts
describe('POST /api/chat with a listing', () => {
  it('answers 400 for a host outside the allowlist and never fetches', async () => {
    const fetchListing = vi.fn();
    const app = buildServer({ callModel: async () => ({ content: '', truncated: false }), fetchListing });
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: { messages: [{ role: 'user', content: 'x' }], fields: [], listing: { url: 'https://urbania.pe/x' } },
    });
    await app.close();
    expect(res.statusCode).toBe(400);
    expect(fetchListing).not.toHaveBeenCalled();
  });

  it('streams a listing event through the injected fetcher', async () => {
    const reply = JSON.stringify({ proyecto: 'A', distrito: 'Lince', modelos: [{ area: '55', precioDesde: '300,000' }], dudosos: [] });
    const app = buildServer({
      callModel: async () => ({ content: reply, truncated: false }),
      fetchListing: async () => 'texto',
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: { messages: [{ role: 'user', content: 'x' }], fields: [], listing: { url: 'https://nexoinmobiliario.pe/departamentos/lince/a-1' } },
    });
    await app.close();
    expect(parseEvents(res.body).at(-1)!.event).toBe('listing');
  });
});
```

Append to `apps/api/src/prompt.test.ts`:

```ts
describe('renderFields with anuncio provenance', () => {
  it('tells the model a field was read from the listing, not stated by the user', () => {
    const [, fieldsMsg] = buildMessages([], [
      { key: 'precio', label: 'Precio', value: '363,906', prefix: 'S/', provenance: 'anuncio', note: '' },
    ]);
    expect(fieldsMsg!.content).toContain('(anuncio)');
    expect(fieldsMsg!.content).toMatch(/anuncio.*leído del anuncio/i);
  });
});
```

(`buildMessages` is already imported in that file; if not, add it to the import.)

- [ ] **Step 3: Run to verify they fail**

Run: `pnpm --filter @chat/api test -- turn.listing chat prompt`
Expected: FAIL — `listing` stripped from the body (no schema), no branch, `fetchListing` not a known dep, no anuncio sentence.

- [ ] **Step 4: Implement the body schema and branch**

In `apps/api/src/turn.ts`:

Add imports:

```ts
import { isListingHost } from '@chat/shared';
import { fetchListingText, type FetchListing } from './listing/fetchListing.ts';
import { runListingPipeline } from './pipeline/listing.ts';
```

and add `buildListingMessages` to the existing `./prompt.ts` import.

Add above `BodySchema`:

```ts
// The browser already checked the host; check it again here because this
// endpoint is public and the body is whatever the caller sends.
const ListingRequestSchema = z.object({
  url: z
    .string()
    .url()
    .refine((u) => {
      try {
        return isListingHost(new URL(u).hostname);
      } catch {
        return false;
      }
    }, 'host not allowed'),
});
```

Add `listing: ListingRequestSchema.optional(),` to `BodySchema` after `document`.

Change the signature to:

```ts
export async function* runTurn(
  body: ChatBody,
  callModel: CallModel,
  fetchListing: FetchListing = fetchListingText,
): AsyncGenerator<SSEEvent> {
```

Insert this branch **before** `if (body.document)`:

```ts
  // A link turn, like a document turn, branches before the guardrail: the
  // message is the URL and the page is the payload.
  if (body.listing) {
    const { url } = body.listing;
    yield { event: 'analyzeStep', data: { label: 'Leyendo el anuncio' } };
    yield { event: 'status', data: { phase: 'analyzing' } };

    let text: string;
    try {
      text = await fetchListing(url);
    } catch (err) {
      console.error('[chat] listing fetch failed:', err);
      yield { event: 'status', data: { phase: 'streaming' } };
      yield {
        event: 'error',
        data: { kind: 'listing', message: 'No pude abrir ese anuncio. Prueba de nuevo o pégame los datos.' },
      };
      return;
    }

    try {
      const { content } = await callModel(buildListingMessages(text), 'document');
      const result = runListingPipeline(content, { host: new URL(url).hostname.toLowerCase(), url });
      yield { event: 'status', data: { phase: 'streaming' } };
      if (result.ok) {
        yield { event: 'listing', data: { listing: result.listing } };
      } else {
        yield {
          event: 'error',
          data: {
            kind: 'listing',
            message:
              result.reason === 'notListing'
                ? 'Esa página no parece un anuncio de un departamento.'
                : 'No pude leer los datos del anuncio.',
          },
        };
      }
    } catch (err) {
      console.error('[chat] listing extraction failed:', err);
      yield { event: 'error', data: modelErrorData(err) };
    }
    return;
  }
```

- [ ] **Step 5: Thread the fetcher through the server**

In `apps/api/src/routes/chat.ts`:

```ts
import { fetchListingText, type FetchListing } from '../listing/fetchListing.ts';

export interface ServerDeps {
  callModel: (messages: ChatMessage[], mode: ModelMode) => Promise<ModelReply>;
  /** Injectable so tests never touch the network. */
  fetchListing?: FetchListing;
}
```

(keep whatever type `callModel` already has in that file — only add `fetchListing`), and change the loop to:

```ts
      for await (const { event, data } of runTurn(body, deps.callModel, deps.fetchListing ?? fetchListingText)) {
```

- [ ] **Step 6: Tell the chat model what `anuncio` means**

In `apps/api/src/prompt.ts` `renderFields`, change the returned string to:

```ts
  return `Datos actuales del panel; su procedencia está indicada entre paréntesis. Respétalos salvo que los contradiga explícitamente. Un dato con procedencia "anuncio" fue leído del anuncio de la propiedad, no lo dijo el usuario: trátalo como dato firme del anuncio y nunca lo devuelvas como "user":\n${lines.join('\n')}`;
```

- [ ] **Step 7: Run the API suite**

Run: `pnpm --filter @chat/api test && pnpm --filter @chat/api typecheck`
Expected: PASS, clean.

- [ ] **Step 8: Make a test bite**

In `ListingRequestSchema`, replace `isListingHost(new URL(u).hostname)` with `true`. Expected: "rejects a URL on another host…" and the route's 400 test FAIL. Restore, re-run: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/turn.ts apps/api/src/turn.listing.test.ts apps/api/src/routes/chat.ts apps/api/src/routes/chat.test.ts apps/api/src/prompt.ts apps/api/src/prompt.test.ts
git commit -m "feat(api): read a Nexo listing from a pasted link

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Listing fixtures

**Files:**
- Create: `apps/api/scripts/make-listing-fixture.ts`
- Create: `apps/api/test/fixtures/nexo-aspiria.txt`
- Create: `apps/api/test/fixtures/nexo-single.txt`
- Modify: `apps/api/test/fixtures/README.md`
- Modify: `apps/api/test/fixtures/fixtures.test.ts` (append)

**Interfaces:**
- Consumes: `fetchListingText` (Task 2).
- Produces: two reduced-text fixtures the manual integration and the fixtures test rely on.

- [ ] **Step 1: Write the script**

Create `apps/api/scripts/make-listing-fixture.ts`:

```ts
import { writeFileSync } from 'node:fs';
import { fetchListingText } from '../src/listing/fetchListing.ts';

// Usage: node --experimental-strip-types scripts/make-listing-fixture.ts <nexo url> <out file>
// Produces the same reduced text the server sends to the model, so the
// fixture is exactly what extraction sees. Inspect the output by eye before
// committing: a listing page carries no personal data, but check anyway.
const [url, out] = process.argv.slice(2);
if (!url || !out) {
  console.error('usage: make-listing-fixture.ts <url> <out>');
  process.exit(1);
}
const text = await fetchListingText(url);
writeFileSync(out, text + '\n');
console.log(`${out}: ${text.length} chars`);
```

- [ ] **Step 2: Generate the two fixtures**

From `apps/api`:

```bash
node --experimental-strip-types scripts/make-listing-fixture.ts https://nexoinmobiliario.pe/departamentos/barranco/aspiria-1631 test/fixtures/nexo-aspiria.txt
```

For the single-model fixture, pick a URL from `https://nexoinmobiliario.pe/sitemap-proyectos.xml` whose page lists exactly one "Modelo" row (open the reduced text and count "Modelo TIPO" / "unidades disponibles" occurrences; try a few until one has a single row) and write it to `test/fixtures/nexo-single.txt`. Record which URL in the README.

Open both files. Confirm: first line is a JSON-LD block starting `{"@context"` or `{"@type"`; no email addresses; no phone numbers of a person (a `Correo Electrónico` form label is fine, a real address is not). Under 20 KB each.

- [ ] **Step 3: Write the fixtures test**

Append to `apps/api/test/fixtures/fixtures.test.ts`:

```ts
const aspiria = readFileSync(path.join(fixturesDir, 'nexo-aspiria.txt'), 'utf8');
const single = readFileSync(path.join(fixturesDir, 'nexo-single.txt'), 'utf8');

describe('listing fixtures', () => {
  it('nexo-aspiria.txt opens with a JSON-LD Product block and carries the three models', () => {
    expect(aspiria.split('\n')[0]).toMatch(/"@type"\s*:\s*"Product"/);
    expect(aspiria).toContain('TIPO 3');
    expect(aspiria).toContain('82.96');
    expect(aspiria).toContain('664,806');
    expect(aspiria).toContain('363,906');
    expect(aspiria).toContain('Barranco');
  });

  it('nexo-single.txt opens with a JSON-LD Product block', () => {
    expect(single.split('\n')[0]).toMatch(/"@type"\s*:\s*"Product"/);
  });

  it('neither fixture carries an email address or a long digit run', () => {
    for (const text of [aspiria, single]) {
      expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
      expect(text.match(/\d{9,}/g) ?? []).toEqual([]);
    }
  });
});
```

If the `\d{9,}` check trips on a legitimate value (a `Product` `sku`, a view counter), tighten the regex to what actually leaked rather than deleting the assertion, and say why in a comment.

- [ ] **Step 4: Run it**

Run: `pnpm --filter @chat/api test -- fixtures`
Expected: PASS.

- [ ] **Step 5: Update the README**

Append to `apps/api/test/fixtures/README.md`:

```md
## Listing fixtures (Fase A)

- `nexo-aspiria.txt` — `https://nexoinmobiliario.pe/departamentos/barranco/aspiria-1631`, a project with three models.
- `nexo-single.txt` — `<the URL you used>`, a project with one model.

Both are the server's reduced text (`htmlToText`), regenerated with
`node --experimental-strip-types scripts/make-listing-fixture.ts <url> <out>`.
A listing page is public and carries no personal data; still, inspect the
output before committing.

A Urbania page saved as PDF is **not** in the repository: the owner runs it
through the app by hand (see the plan's verification task).
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/scripts/make-listing-fixture.ts apps/api/test/fixtures
git commit -m "test(api): reduced-text fixtures for two Nexo listings

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Reducer, persistence and turn history

**Files:**
- Modify: `apps/web/src/state/chatReducer.ts`
- Modify: `apps/web/src/state/chatReducer.test.ts` (append)
- Modify: `apps/web/src/state/persistence.ts`
- Modify: `apps/web/src/state/persistence.test.ts` (append)
- Modify: `apps/web/src/state/guidance.ts` — `toTurns`
- Modify: `apps/web/src/state/guidance.test.ts` (append)

**Interfaces:**
- Consumes: `Listing`, `PinnedField`, `listingRefusal`, `deriveInicial` from `@chat/shared`.
- Produces:
  - `Message` gains `{ id: string; role: 'assistant-note'; content: string }`.
  - `ChatState.pendingListing: Listing | null`.
  - `ChatError['kind']` gains `'listing'`.
  - Actions: `{ type: 'refuseListing'; content: string; host: string }`, `{ type: 'listingReady'; listing: Listing }`, `{ type: 'confirmListing'; fields: PinnedField[] }`, `{ type: 'cancelListing' }`.

- [ ] **Step 1: Write the failing reducer tests**

Append to `apps/web/src/state/chatReducer.test.ts` (reuse the file's existing imports of `chatReducer`, `initialState`; add `type Listing, type PinnedField` from `@chat/shared` if missing):

```ts
const LISTING: Listing = {
  proyecto: 'ASPIRIA', constructora: 'GRUPO T&C', direccion: 'Av. El Sol Este 530', distrito: 'Barranco',
  entrega: undefined, etapa: undefined,
  modelos: [{ nombre: 'TIPO 7', area: '41.75', precioDesde: '363,906', dormitorios: '1' }],
  fuente: { host: 'nexoinmobiliario.pe' }, dudosos: [],
};

const pf = (key: PinnedField['key'], value: string, provenance: PinnedField['provenance'] = 'anuncio'): PinnedField => ({
  key, label: key, value, prefix: undefined, suffix: undefined, provenance, note: '',
});

const LISTING_FIELDS = [pf('ubicacion', 'Av. El Sol Este 530, Barranco'), pf('precio', '363,906'), pf('area', '41.75')];

describe('listing actions', () => {
  it('refuseListing records the user message and the refusal locally, staying idle', () => {
    const s = chatReducer(initialState, { type: 'refuseListing', content: 'https://urbania.pe/x', host: 'urbania.pe' });
    expect(s.status).toBe('idle');
    expect(s.messages.map((m) => m.role)).toEqual(['user', 'assistant-note']);
    expect((s.messages[1] as { content: string }).content).toContain('De urbania.pe no puedo leer el anuncio');
  });

  it('listingReady parks the read and clears the progress row', () => {
    const busy = { ...initialState, status: 'analyzing' as const, attachment: { name: 'nexoinmobiliario.pe', size: 0 } };
    const s = chatReducer(busy, { type: 'listingReady', listing: LISTING });
    expect(s.pendingListing).toBe(LISTING);
    expect(s.status).toBe('idle');
    expect(s.attachment).toBeNull();
  });

  it('cancelListing pins nothing', () => {
    const s = chatReducer({ ...initialState, pendingListing: LISTING }, { type: 'cancelListing' });
    expect(s.pendingListing).toBeNull();
    expect(s.fields).toEqual({});
  });

  it('confirmListing replaces the property as one entity and records a note', () => {
    const before = {
      ...initialState,
      pendingListing: LISTING,
      fields: { ubicacion: pf('ubicacion', 'Lince', 'assumed'), precio: pf('precio', '300,000', 'assumed'), tasa: pf('tasa', '8', 'user') },
    };
    const s = chatReducer(before, { type: 'confirmListing', fields: LISTING_FIELDS });
    expect(s.fields.ubicacion!.value).toBe('Av. El Sol Este 530, Barranco');
    expect(s.fields.precio!.value).toBe('363,906');
    expect(s.fields.area!.value).toBe('41.75');
    expect(s.fields.tasa!.value).toBe('8');
    expect(s.pendingListing).toBeNull();
    expect(s.messages.at(-1)).toMatchObject({ role: 'assistant-note' });
    expect((s.messages.at(-1) as { content: string }).content).toMatch(/del anuncio/);
  });

  it('confirmListing keeps a user-typed key and turns the listing value into a proposal', () => {
    const before = { ...initialState, userEdited: ['precio'], fields: { precio: pf('precio', '400,000', 'user') } };
    const s = chatReducer(before, { type: 'confirmListing', fields: LISTING_FIELDS });
    expect(s.fields.precio!.value).toBe('400,000');
    expect(s.proposals.precio!.value).toBe('363,906');
  });

  it('confirmListing drops an estimated alquiler and keeps a typed one', () => {
    const est = { ...initialState, fields: { alquiler: pf('alquiler', '1,500', 'market') } };
    expect(chatReducer(est, { type: 'confirmListing', fields: LISTING_FIELDS }).fields.alquiler).toBeUndefined();
    const typed = { ...initialState, fields: { alquiler: pf('alquiler', '1,500', 'user') } };
    expect(chatReducer(typed, { type: 'confirmListing', fields: LISTING_FIELDS }).fields.alquiler!.value).toBe('1,500');
  });

  it('confirmListing derives inicial from the new price and a financed amount', () => {
    const before = {
      ...initialState,
      mortgage: { montoFinanciado: { key: 'montoFinanciado' as const, label: 'Monto financiado', value: '300,000', prefix: 'S/', suffix: undefined, provenance: 'documento' as const, note: '' } },
    };
    const s = chatReducer(before, { type: 'confirmListing', fields: LISTING_FIELDS });
    expect(s.fields.inicial!.value).toBe('63,906');
    expect(s.fields.inicial!.provenance).toBe('assumed');
  });

  it('a later envelope with the same value keeps anuncio provenance', () => {
    const before = { ...initialState, fields: { precio: pf('precio', '363,906') } };
    const s = chatReducer(before, {
      type: 'envelope',
      envelope: {
        verdict: 'ok', fields: [pf('precio', '363,906', 'assumed')], metrics: [], scenarios: [], sources: [], prose: [], followUps: [],
      },
    });
    expect(s.fields.precio!.provenance).toBe('anuncio');
  });

  it('an error of kind listing is stored as such', () => {
    const s = chatReducer(initialState, { type: 'error', kind: 'listing', message: 'x', retry: null });
    expect(s.error?.kind).toBe('listing');
  });
});
```

- [ ] **Step 2: Write the failing persistence and guidance tests**

Append to `apps/web/src/state/persistence.test.ts` (match the file's existing helpers for stubbing `localStorage`):

```ts
it('never persists pendingListing', () => {
  saveState({ ...initialState, pendingListing: { proyecto: 'A', distrito: 'B', modelos: [], fuente: { host: 'pdf' }, dudosos: [] } });
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).not.toHaveProperty('pendingListing');
  expect(loadState().pendingListing).toBeNull();
});
```

Append to `apps/web/src/state/guidance.test.ts`:

```ts
it('toTurns sends an assistant-note as an assistant turn', () => {
  const turns = toTurns([{ id: '1', role: 'assistant-note', content: 'Fijé ubicación del anuncio.' }]);
  expect(turns).toEqual([{ role: 'assistant', content: 'Fijé ubicación del anuncio.' }]);
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `pnpm --filter @chat/web test -- chatReducer persistence guidance`
Expected: FAIL / type errors on the new actions.

- [ ] **Step 4: Implement the reducer**

In `apps/web/src/state/chatReducer.ts`:

Add to the `@chat/shared` import: `listingRefusal, type Listing`.

`Message` union — add:

```ts
  | { id: string; role: 'assistant-note'; content: string }
```

`ChatState` — add after `pendingExtraction`:

```ts
  /** A listing read but not yet confirmed. Never persisted. */
  pendingListing: Listing | null;
```

`ChatError.kind` — becomes `'api' | 'offline' | 'document' | 'request' | 'limit' | 'listing'`.

`Action` — add:

```ts
  | { type: 'refuseListing'; content: string; host: string }
  | { type: 'listingReady'; listing: Listing }
  | { type: 'confirmListing'; fields: PinnedField[] }
  | { type: 'cancelListing' }
```

`initialState` — add `pendingListing: null,`.

In the `envelope` case, change

```ts
          fields[f.key] = state.userEdited.includes(f.key)
            ? { ...f, provenance: prev.provenance }
            : f;
```

to

```ts
          // Same for a value read from a listing: the model echoing it back
          // as 'assumed' must not demote what the page actually said.
          fields[f.key] = state.userEdited.includes(f.key) || prev.provenance === 'anuncio'
            ? { ...f, provenance: prev.provenance }
            : f;
```

Add these cases before `case 'reset':`:

```ts
    case 'refuseListing':
      // Local, no model call: the host is not one we can read. Both sides of
      // the exchange land in the transcript so the conversation records it.
      return {
        ...state,
        messages: [
          ...state.messages,
          { id: nextId(), role: 'user', content: action.content },
          { id: nextId(), role: 'assistant-note', content: listingRefusal(action.host) },
        ],
        pendingField: null,
      };

    case 'listingReady':
      return {
        ...state,
        pendingListing: action.listing,
        status: 'idle',
        attachment: null,
        analyzeSteps: state.analyzeSteps.map((s) => ({ ...s, done: true })),
      };

    case 'cancelListing':
      return { ...state, pendingListing: null };

    case 'confirmListing': {
      // A link describes a property; a new link is a new property. The three
      // keys replace as one entity — a user-typed key keeps its value and the
      // listing's becomes a proposal, the rule the envelope path applies.
      const fields = { ...state.fields };
      const proposals = { ...state.proposals };
      const pinned: string[] = [];
      for (const f of action.fields) {
        const prev = fields[f.key];
        if (prev && state.userEdited.includes(f.key) && prev.value !== f.value) {
          proposals[f.key] = f;
          continue;
        }
        fields[f.key] = f;
        pinned.push(f.label.toLowerCase());
      }

      // An estimated rent was for the previous location and area. A typed one
      // is the user's and stays.
      if (fields.alquiler && (fields.alquiler.provenance === 'market' || fields.alquiler.provenance === 'assumed')) {
        delete fields.alquiler;
      }

      // Same derivation confirmExtraction does, never over a user-owned value.
      const financed = state.mortgage.montoFinanciado?.value;
      const inicial = deriveInicial(fields.precio?.value, financed);
      if (inicial && !state.userEdited.includes('inicial')) {
        fields.inicial = {
          key: 'inicial',
          label: 'Inicial',
          value: inicial,
          prefix: 'S/',
          provenance: 'assumed',
          note: 'Calculada: precio menos el monto que financia el banco.',
        };
      }

      const note =
        pinned.length > 0
          ? `Fijé ${pinned.join(', ').replace(/, ([^,]*)$/, ' y $1')} del anuncio.`
          : 'Mantuve tus datos; lo que leí del anuncio quedó como propuesta.';

      return {
        ...state,
        fields,
        proposals,
        pendingListing: null,
        // Pinning data does not recalculate a previous analysis; keep its baseline.
        baseline: { ...deriveBaseline(fields), ...state.baseline },
        messages: [...state.messages, { id: nextId(), role: 'assistant-note', content: note }],
      };
    }
```

- [ ] **Step 5: Persistence and guidance**

In `apps/web/src/state/persistence.ts`: add `'pendingListing'` to the `Omit<...>` list, `pendingListing: null` to the object `loadState` returns, and `pendingListing: _pl,` to the destructuring in `saveState`. Extend the doc comment: "`pendingListing` likewise — an unconfirmed listing dies with the page."

In `apps/web/src/state/guidance.ts` `toTurns`, add before the `assistant-fallback` line:

```ts
    if (message.role === 'assistant-note') return { role: 'assistant', content: message.content };
```

- [ ] **Step 6: Run the web state tests and typecheck**

Run: `pnpm --filter @chat/web test -- chatReducer persistence guidance && pnpm --filter @chat/web typecheck`
Expected: tests PASS. Then add this branch in `apps/web/src/screens/Conversation.tsx` right after the `assistant-question` branch — unconditionally, because without it an `assistant-note` falls into the fallback render (which reads `m.prose`), and Task 8's refusal test needs the note on screen:

```tsx
              if (m.role === 'assistant-note') {
                return <p key={m.id} className="ch-line text-[13.5px] leading-[1.6] text-slate-300 md:text-[14.5px]">{m.content}</p>;
              }
```

- [ ] **Step 7: Make a test bite**

In the `envelope` case, remove `|| prev.provenance === 'anuncio'`. Expected: "a later envelope with the same value keeps anuncio provenance" FAILS. Restore, re-run: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/state apps/web/src/screens/Conversation.tsx
git commit -m "feat(web): reducer state for a read listing, refusal and confirmation

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Sending a link from the composer

**Files:**
- Modify: `apps/web/src/api/streamChat.ts`
- Modify: `apps/web/src/api/streamChat.test.ts` (append)
- Create: `apps/web/src/listing/readListing.ts`
- Create: `apps/web/src/listing/readListing.test.ts`
- Modify: `apps/web/src/App.tsx` — `send`
- Modify: `apps/web/src/App.test.tsx` (append)

**Interfaces:**
- Consumes: `findListingUrl`, `isListingHost` (Task 1); reducer actions (Task 7).
- Produces:
  - `ChatRequest.listing?: { url: string }`.
  - `readListing(url: string, host: string, dispatch: (a: Action) => void, fields: PinnedField[]): Promise<void>`.

- [ ] **Step 1: Write the failing streamChat test**

Append to `apps/web/src/api/streamChat.test.ts`, next to the existing "does not synthesise a dropped-connection error after an extraction event" test, using that test's `mockFetch` helper:

```ts
  it('treats a listing event as terminal', async () => {
    const events: string[] = [];
    await streamChat(
      { messages: [], fields: [], listing: { url: 'https://nexoinmobiliario.pe/x' } },
      (e) => events.push(e.event),
      mockFetch('event: status\ndata: {"phase":"analyzing"}\n\nevent: listing\ndata: {"listing":{}}\n\n'),
    );
    expect(events).toEqual(['status', 'listing']);
  });
```

- [ ] **Step 2: Write the failing readListing tests**

Create `apps/web/src/listing/readListing.test.ts`:

```ts
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
  beforeEach(() => vi.mocked(streamChat).mockReset());

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
```

- [ ] **Step 3: Write the failing App tests**

Append to `apps/web/src/App.test.tsx`, following that file's existing pattern for mocking `streamChat` and rendering `<App />` (reuse its helpers; the names below assume `render`, `screen`, `userEvent`, and a mocked `streamChat`):

```ts
describe('pasting a listing link', () => {
  it('refuses a foreign host locally without calling the API', async () => {
    render(<App />);
    await userEvent.type(screen.getAllByPlaceholderText(/cuéntame/i)[0]!, 'mira https://urbania.pe/inmueble/123');
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByText(/De urbania.pe no puedo leer el anuncio/)).toBeInTheDocument();
    expect(vi.mocked(streamChat)).not.toHaveBeenCalled();
  });

  it('sends a Nexo link as a listing request', async () => {
    vi.mocked(streamChat).mockResolvedValue(undefined);
    render(<App />);
    await userEvent.type(screen.getAllByPlaceholderText(/cuéntame/i)[0]!, 'https://nexoinmobiliario.pe/departamentos/barranco/aspiria-1631');
    await userEvent.keyboard('{Enter}');
    expect(vi.mocked(streamChat).mock.calls[0]![0].listing).toEqual({
      url: 'https://nexoinmobiliario.pe/departamentos/barranco/aspiria-1631',
    });
  });
});
```

- [ ] **Step 4: Run to verify they fail**

Run: `pnpm --filter @chat/web test -- streamChat readListing App`
Expected: FAIL.

- [ ] **Step 5: Implement**

`apps/web/src/api/streamChat.ts`: add `listing?: { url: string };` to `ChatRequest`, and add `|| e.event === 'listing'` to the `sawTerminal` condition.

Create `apps/web/src/listing/readListing.ts`:

```ts
import type { PinnedField } from '@chat/shared';
import { streamChat } from '../api/streamChat';
import type { Action } from '../state/chatReducer';

/**
 * Sends a listing URL for the server to read. Sibling of pdf/attachSchedule:
 * same progress row, same event handling, but nothing is read in the browser
 * — the page never comes here, only the extracted listing does.
 */
export async function readListing(
  url: string,
  host: string,
  dispatch: (action: Action) => void,
  fields: PinnedField[],
): Promise<void> {
  // size 0 is the row's cue that there is no local file to read.
  dispatch({ type: 'attachStart', name: host, size: 0 });

  await streamChat(
    { messages: [{ role: 'user', content: url }], fields, listing: { url } },
    (e) => {
      const data = e.data as Record<string, any>;
      if (e.event === 'status') dispatch({ type: 'status', phase: data.phase });
      else if (e.event === 'analyzeStep') dispatch({ type: 'analyzeStep', label: data.label });
      else if (e.event === 'listing') dispatch({ type: 'listingReady', listing: data.listing });
      else if (e.event === 'error')
        dispatch({
          type: 'error',
          kind: data.kind === 'listing' ? 'listing' : 'api',
          message: data.message,
          // The pasted message, so "Editar" can seed the composer with it.
          retry: url,
        });
    },
  );
}
```

In `apps/web/src/App.tsx`:

```ts
import { findListingUrl, isListingHost, type FieldKey, type PinnedField, type Scenario } from '@chat/shared';
import { readListing } from './listing/readListing';
```

and change `send` to:

```ts
  const send = useCallback(
    async (text: string) => {
      // A pasted link is a read, not a question. The refusal is local; the
      // read goes through its own request with the URL as the payload.
      const link = findListingUrl(text);
      if (link && !isListingHost(link.host)) {
        dispatch({ type: 'refuseListing', content: text, host: link.host });
        return;
      }
      // Offline: the message is pending, not lost — hold it for reconnect.
      if (state.offline) {
        dispatch({ type: 'queue', content: text });
        return;
      }
      dispatch({ type: 'send', content: text });
      if (link) {
        await readListing(link.url, link.host, dispatch, Object.values(state.fields));
        return;
      }
      const turns = toTurns([...state.messages, { id: 'pending', role: 'user', content: text, respondingTo: state.pendingField ?? undefined }]);
      await request(turns, Object.values(state.fields));
    },
    [state.offline, state.messages, state.fields, state.pendingField, request],
  );
```

- [ ] **Step 6: Run and typecheck**

Run: `pnpm --filter @chat/web test -- streamChat readListing App && pnpm --filter @chat/web typecheck`
Expected: PASS, clean.

- [ ] **Step 7: Make a test bite**

In `App.tsx`, change `if (link && !isListingHost(link.host))` to `if (false)`. Expected: "refuses a foreign host locally…" FAILS (streamChat called). Restore, re-run: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/api apps/web/src/listing apps/web/src/App.tsx apps/web/src/App.test.tsx
git commit -m "feat(web): a pasted Nexo link reads the listing; other hosts get an honest refusal

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: The confirmation modal, anuncio variant

**Files:**
- Modify: `apps/web/src/components/ConfirmExtraction.tsx`
- Modify: `apps/web/src/components/ConfirmExtraction.test.tsx` (append)

**Interfaces:**
- Consumes: `Listing`, `ListingModel`, `PinnedField`, `MortgageField`, `listingToFields` from `@chat/shared`.
- Produces: props become a discriminated union —

```ts
type Props = { onCancel: () => void } & (
  | { variant?: 'cronograma'; fields: MortgageField[]; onConfirm: (fields: MortgageField[]) => void }
  | { variant: 'anuncio'; listing: Listing; onConfirm: (fields: PinnedField[]) => void }
);
```

Existing callers (`variant` omitted) are unchanged.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/src/components/ConfirmExtraction.test.tsx` (add `type Listing` to the `@chat/shared` import):

```ts
const ASPIRIA: Listing = {
  proyecto: 'ASPIRIA', constructora: 'GRUPO T&C', direccion: 'Av. El Sol Este 530', distrito: 'Barranco',
  entrega: 'febrero 2027', etapa: undefined,
  modelos: [
    { nombre: 'TIPO 3', area: '82.96', precioDesde: '664,806', dormitorios: '3' },
    { nombre: 'TIPO 7', area: '41.75', precioDesde: '363,906', dormitorios: '1' },
  ],
  fuente: { host: 'nexoinmobiliario.pe' }, dudosos: [],
};

describe('ConfirmExtraction — anuncio', () => {
  it('names the project, district and developer', () => {
    render(<ConfirmExtraction variant="anuncio" listing={ASPIRIA} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('dialog')).toHaveTextContent('ASPIRIA · Barranco · GRUPO T&C · entrega febrero 2027');
  });

  it('lists the models and keeps the CTA disabled until one is chosen', async () => {
    render(<ConfirmExtraction variant="anuncio" listing={ASPIRIA} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(radios[0]).toHaveAccessibleName('TIPO 3 · 82.96 m² · desde S/ 664,806');
    expect(screen.getByRole('button', { name: /fijar/i })).toBeDisabled();
    expect(screen.getByLabelText('Precio')).toHaveValue('');
  });

  it('choosing a model fills price and area; editing after choosing sticks', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmExtraction variant="anuncio" listing={ASPIRIA} onConfirm={onConfirm} onCancel={vi.fn()} />);
    await userEvent.click(screen.getAllByRole('radio')[1]!);
    expect(screen.getByLabelText('Precio')).toHaveValue('363,906');
    expect(screen.getByLabelText('Área')).toHaveValue('41.75');
    const precio = screen.getByLabelText('Precio');
    await userEvent.clear(precio);
    await userEvent.type(precio, '370,000');
    await userEvent.click(screen.getByRole('button', { name: /fijar/i }));
    const fields = onConfirm.mock.calls[0]![0] as { key: string; value: string; provenance: string }[];
    expect(fields.find((f) => f.key === 'precio')).toMatchObject({ value: '370,000', provenance: 'user' });
    expect(fields.find((f) => f.key === 'area')).toMatchObject({ value: '41.75', provenance: 'anuncio' });
    expect(fields.find((f) => f.key === 'ubicacion')).toMatchObject({ value: 'Av. El Sol Este 530, Barranco' });
  });

  it('with one model shows no list and starts filled', () => {
    const one: Listing = { ...ASPIRIA, modelos: [ASPIRIA.modelos[1]!] };
    render(<ConfirmExtraction variant="anuncio" listing={one} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByLabelText('Precio')).toHaveValue('363,906');
    expect(screen.getByRole('button', { name: /fijar/i })).toBeEnabled();
  });

  it('warns that a "desde" is the model floor', () => {
    render(<ConfirmExtraction variant="anuncio" listing={ASPIRIA} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('dialog')).toHaveTextContent(/desde.*precio más bajo/i);
  });

  it('highlights a dudoso field first', () => {
    const one: Listing = { ...ASPIRIA, modelos: [ASPIRIA.modelos[1]!], dudosos: ['precioDesde'] };
    render(<ConfirmExtraction variant="anuncio" listing={one} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText('Precio')).toHaveAttribute('data-dudoso', 'true');
    expect(screen.getByLabelText('Área')).toHaveAttribute('data-dudoso', 'false');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @chat/web test -- ConfirmExtraction`
Expected: FAIL — type error on `variant`/`listing`.

- [ ] **Step 3: Rewrite the component**

Replace `apps/web/src/components/ConfirmExtraction.tsx` with:

```tsx
import { useEffect, useRef, useState } from 'react';
import { listingToFields, type Listing, type MortgageField, type PinnedField } from '@chat/shared';

type Props = { onCancel: () => void } & (
  | { variant?: 'cronograma'; fields: MortgageField[]; onConfirm: (fields: MortgageField[]) => void }
  | { variant: 'anuncio'; listing: Listing; onConfirm: (fields: PinnedField[]) => void }
);

type AnyField = MortgageField | PinnedField;

const COPY = {
  cronograma: {
    ariaLabel: 'Revisar lo que leí del cronograma',
    heading: 'Esto leí de tu cronograma',
    warning:
      'Dale una mirada antes de fijarlo. Puede leer mal un dígito y verse igual de seguro, y estas cifras son la base de todo lo que calcule después.',
    firm: 'documento' as const,
  },
  anuncio: {
    ariaLabel: 'Revisar lo que leí del anuncio',
    heading: 'Leí el anuncio',
    warning: "Un 'desde' es el precio más bajo del modelo; el tuyo puede ser otro. Revísalo antes de fijar.",
    firm: 'anuncio' as const,
  },
};

function modelLabel(m: Listing['modelos'][number]): string {
  return [m.nombre, m.area ? `${m.area} m²` : undefined, m.precioDesde ? `desde S/ ${m.precioDesde}` : undefined]
    .filter(Boolean)
    .join(' · ');
}

/**
 * The read is shown before it pins. Its job is not ceremony: a digit read off a
 * photo can be wrong and still look confident, and it would land in the field
 * the whole analysis is built on. The anuncio variant adds the one thing a
 * listing needs that a schedule does not: which of the project's models the
 * user is actually looking at.
 */
export function ConfirmExtraction(props: Props) {
  const variant = props.variant ?? 'cronograma';
  const copy = COPY[variant];
  const listing = props.variant === 'anuncio' ? props.listing : null;
  const single = listing !== null && listing.modelos.length === 1;

  const [chosen, setChosen] = useState<number | null>(single ? 0 : null);
  const [draft, setDraft] = useState<AnyField[]>(() =>
    props.variant === 'anuncio'
      ? listingToFields(props.listing, single ? props.listing.modelos[0]! : null)
      : props.fields,
  );
  const dialogRef = useRef<HTMLDivElement>(null);
  const { onCancel } = props;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  // Mounted only while open (no `open` prop — the parent controls mounting), so
  // "on close" here means unmount: grab the pre-open focus now and hand it back
  // in the cleanup, trap Tab in a cycle while mounted, and lock body scroll —
  // same idiom as MobileBottomSheet's dialog.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const getFocusable = () =>
      dialogRef.current
        ? Array.from(
            dialogRef.current.querySelectorAll<HTMLElement>(
              'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
            ),
          )
        : [];

    // Land on the first control, not the confirm button — the point of this
    // dialog is reading (or choosing) before accepting.
    (getFocusable()[0] ?? dialogRef.current)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  // A digit changed here is no longer what the page or the bank said — it is
  // what the person typed, so it must pin as 'user', matching the panel's
  // edit convention. The note stays: it describes the field's nature, not
  // the specific digit read, so it is still accurate after the correction.
  const edit = (key: string, value: string) =>
    setDraft((d) => d.map((f) => (f.key === key ? { ...f, value, provenance: 'user' } : f)));

  const choose = (i: number) => {
    if (!listing) return;
    setChosen(i);
    setDraft(listingToFields(listing, listing.modelos[i]!));
  };

  // Ubicación/Precio/Área always show for a listing, even before a model is
  // chosen, so the user sees what choosing will fill.
  const rows: AnyField[] =
    listing && chosen === null
      ? [
          ...draft,
          { key: 'precio', label: 'Precio', value: '', prefix: 'S/', suffix: undefined, provenance: 'anuncio', note: '' },
          { key: 'area', label: 'Área', value: '', prefix: undefined, suffix: 'm²', provenance: 'anuncio', note: '' },
        ]
      : draft;

  const canConfirm = variant === 'cronograma' || draft.some((f) => f.key === 'precio' && f.value.trim());

  const confirm = () => {
    if (props.variant === 'anuncio') props.onConfirm(draft as PinnedField[]);
    else props.onConfirm(draft as MortgageField[]);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-5">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={copy.ariaLabel}
        tabIndex={-1}
        className="ch-rise max-h-[85vh] w-full max-w-[440px] overflow-y-auto rounded-xl border border-ch-border bg-ch-panel p-5 outline-none"
      >
        <h2 className="font-jakarta text-[19px] font-extrabold tracking-[-.02em] text-white">{copy.heading}</h2>
        {listing && (
          <p className="mt-1 text-[13px] font-medium text-slate-200">
            {[listing.proyecto, listing.distrito, listing.constructora, listing.entrega ? `entrega ${listing.entrega}` : undefined]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
        <p className="mt-2 text-[12.5px] leading-[1.6] text-slate-400">{copy.warning}</p>

        {listing && !single && (
          <fieldset className="mt-4">
            <legend className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-500">
              ¿Cuál modelo estás viendo?
            </legend>
            <div className="mt-2 flex flex-col gap-[6px]">
              {listing.modelos.map((m, i) => {
                const label = modelLabel(m);
                return (
                  <label
                    key={`${m.nombre ?? 'modelo'}-${i}`}
                    className={`flex cursor-pointer items-center gap-[10px] rounded-[10px] border px-3 py-[9px] text-[13px] text-slate-200 ${
                      chosen === i ? 'border-ch-accent' : 'border-ch-border hover:border-ch-border-hover'
                    }`}
                  >
                    <input
                      type="radio"
                      name="modelo"
                      checked={chosen === i}
                      onChange={() => choose(i)}
                      aria-label={label}
                      className="accent-ch-accent"
                    />
                    <span className="tnum">{label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        <div className="mt-4 flex flex-col gap-[10px]">
          {rows.map((f) => {
            const dudoso = f.provenance !== copy.firm;
            return (
              <div
                key={f.key}
                className={`rounded-[10px] border px-3 py-[10px] ${dudoso ? 'border-ch-accent' : 'border-ch-border'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-500">{f.label}</span>
                  {dudoso && f.value && <span className="text-[10px] font-semibold text-ch-accent">revisa este</span>}
                </div>
                <div className="mt-[6px] flex items-baseline gap-[5px]">
                  {f.prefix && <span className="text-[14px] font-bold text-slate-500">{f.prefix}</span>}
                  <input
                    value={f.value}
                    onChange={(e) => edit(f.key, e.target.value)}
                    aria-label={f.label}
                    data-dudoso={dudoso}
                    disabled={listing !== null && chosen === null && f.key !== 'ubicacion'}
                    placeholder={listing && chosen === null && f.key !== 'ubicacion' ? 'elige un modelo' : undefined}
                    className="tnum min-w-0 flex-1 border-none bg-transparent p-0 font-jakarta text-[17px] font-bold tracking-[-.02em] text-white outline-none placeholder:text-slate-600 disabled:opacity-60"
                  />
                  {f.suffix && <span className="text-[14px] text-slate-400">{f.suffix}</span>}
                </div>
                {f.note && <p className="mt-[6px] text-[11.5px] text-slate-400">{f.note}</p>}
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex gap-[10px]">
          <button
            type="button"
            onClick={onCancel}
            className="h-[44px] flex-1 rounded-full border border-ch-border-hover text-[13.5px] font-semibold text-slate-300 transition-colors duration-180 ease-ch hover:border-slate-500"
          >
            Descartar
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!canConfirm}
            className="h-[44px] flex-1 rounded-full bg-slate-50 text-[13.5px] font-semibold text-ch-bg transition-opacity duration-120 ease-ch hover:opacity-90 active:translate-y-px disabled:opacity-40"
          >
            Fijar estos datos
          </button>
        </div>
      </div>
    </div>
  );
}
```

Note for the implementer: the empty Precio/Área rows shown before a model is chosen carry `provenance: 'anuncio'`, which equals `copy.firm` for this variant, so `dudoso` is `false` and they render with the plain border. The "revisa este" pill is additionally gated on `f.value`, so an empty row never asks to be reviewed. Keep both guards.

- [ ] **Step 4: Run all ConfirmExtraction tests**

Run: `pnpm --filter @chat/web test -- ConfirmExtraction && pnpm --filter @chat/web typecheck`
Expected: the four pre-existing cronograma tests still PASS unchanged; the six new ones PASS; typecheck clean.

- [ ] **Step 5: Make a test bite**

Change `disabled={!canConfirm}` to `disabled={false}`. Expected: "keeps the CTA disabled until one is chosen" FAILS. Restore, re-run: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/ConfirmExtraction.tsx apps/web/src/components/ConfirmExtraction.test.tsx
git commit -m "feat(web): confirm a read listing — choose the model, then pin

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Provenance on screen, progress row, error title, screen wiring

**Files:**
- Modify: `apps/web/src/components/PinnedField.tsx`
- Modify: `apps/web/src/components/PinnedPanel.tsx`
- Modify: `apps/web/src/components/PinnedPanel.test.tsx` (append)
- Modify: `apps/web/src/components/UploadingRow.tsx`
- Modify: `apps/web/src/components/UploadingRow.test.tsx` (append)
- Modify: `apps/web/src/components/ErrorNotice.tsx`
- Modify: `apps/web/src/screens/Conversation.tsx`
- Modify: `apps/web/src/screens/Conversation.test.tsx` (append)

**Interfaces:**
- Consumes: everything above. No new exports.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/src/components/PinnedPanel.test.tsx` (reuse its render helper; the props below are the minimum `PinnedPanel` needs):

```ts
describe('anuncio provenance', () => {
  const precio = { key: 'precio' as const, label: 'Precio', value: '363,906', prefix: 'S/', suffix: undefined, provenance: 'anuncio' as const, note: '' };

  it('shows the page legend only while a field carries anuncio', () => {
    const { rerender } = render(<PinnedPanel fields={[precio]} onEdit={vi.fn()} />);
    expect(screen.getByText('Lo leí de la página')).toBeInTheDocument();
    rerender(<PinnedPanel fields={[{ ...precio, provenance: 'user' }]} onEdit={vi.fn()} />);
    expect(screen.queryByText('Lo leí de la página')).toBeNull();
  });

  it('marks the row as read from the page, not assumed', () => {
    render(<PinnedPanel fields={[precio]} onEdit={vi.fn()} />);
    expect(screen.getByTitle('Lo leí de la página')).toBeInTheDocument();
    expect(screen.queryByTitle('Lo asumí yo')).toBeNull();
  });
});
```

Append to `apps/web/src/components/UploadingRow.test.tsx`:

```ts
describe('link mode (size 0)', () => {
  it('shows the host and the server step, with no size, bar or page-read line', () => {
    render(
      <UploadingRow
        attachment={{ name: 'nexoinmobiliario.pe', size: 0 }}
        status="analyzing"
        steps={[{ label: 'Leyendo el anuncio', done: false }]}
      />,
    );
    expect(screen.getByText('nexoinmobiliario.pe')).toBeInTheDocument();
    expect(screen.getByText(/Leyendo el anuncio/)).toBeInTheDocument();
    expect(screen.queryByText(/KB|MB/)).toBeNull();
    expect(screen.queryByText(/Primera página leída/)).toBeNull();
    expect(screen.queryByText(/Leyendo tu cronograma/)).toBeNull();
  });
});
```

Append to `apps/web/src/screens/Conversation.test.tsx` (reuse its `baseState`/render helpers):

```ts
describe('listing on the conversation screen', () => {
  it('renders an assistant-note as plain text', () => {
    renderConversation({ ...baseState, messages: [{ id: 'n', role: 'assistant-note', content: 'Fijé ubicación del anuncio.' }] });
    expect(screen.getByText('Fijé ubicación del anuncio.')).toBeInTheDocument();
  });

  it('mounts the anuncio modal while a listing is pending, and cancelling dispatches cancelListing', async () => {
    const dispatch = vi.fn();
    renderConversation(
      { ...baseState, pendingListing: { proyecto: 'A', distrito: 'Lince', modelos: [{ area: '55', precioDesde: '300,000' }], fuente: { host: 'pdf' }, dudosos: [] } },
      { dispatch },
    );
    expect(screen.getByRole('dialog', { name: /anuncio/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /descartar/i }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'cancelListing' });
  });

  it('titles a listing error as such', () => {
    renderConversation({ ...baseState, status: 'error', error: { kind: 'listing', message: 'No pude abrir ese anuncio.', retry: 'https://nexoinmobiliario.pe/x' } });
    expect(screen.getByText('No pude leer el anuncio')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reintentar/i })).toBeNull();
    expect(screen.getByRole('button', { name: /editar/i })).toBeInTheDocument();
  });
});
```

Adapt `renderConversation`'s signature to however that file already renders `<Conversation>` with a state and a `dispatch` — do not invent a second helper.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @chat/web test -- PinnedPanel UploadingRow Conversation`
Expected: FAIL.

- [ ] **Step 3: PinnedField and PinnedPanel**

In `apps/web/src/components/PinnedField.tsx` replace the four lines from `const fromDocument` through `const dotTitle` with:

```ts
  const fromDocument = field.provenance === 'documento';
  // A value read from a listing page is likewise firmer than a recollection,
  // and likewise not the user's own word.
  const fromPage = field.provenance === 'anuncio';
  // Provenance is the whole point: a value the user did not state must never
  // read as fact. Anything that is not 'user' (and not already covered above)
  // gets the accent dot — the live model also returns 'market', and testing
  // `=== 'assumed'` would render a market estimate as "Lo dijiste tú".
  const notFromUser = field.provenance !== 'user' && !fromDocument && !fromPage;

  const dotClass = fromDocument || fromPage ? 'bg-emerald-400' : notFromUser ? 'bg-ch-accent' : 'bg-slate-400';
  const dotTitle = fromDocument ? 'Lo leí del banco' : fromPage ? 'Lo leí de la página' : notFromUser ? 'Lo asumí yo' : 'Lo dijiste tú';
```

In `apps/web/src/components/PinnedPanel.tsx`, after the `Lo leí del banco` legend span add:

```tsx
          {fields.some((f) => f.provenance === 'anuncio') && (
            <span className="flex items-center gap-[6px] text-[11px] font-medium text-emerald-400">
              <span className="h-[7px] w-[7px] rounded-full bg-emerald-400" />
              Lo leí de la página
            </span>
          )}
```

- [ ] **Step 4: UploadingRow link mode**

In `apps/web/src/components/UploadingRow.tsx`, after `const reading = status === 'thinking';` add:

```ts
  // size 0 is readListing's cue: nothing was read in the browser, so there is
  // no size, no local bar and no "page read" line — only the server's step.
  const link = attachment.size === 0;
```

Then:
- wrap the size `<span>` as `{!link && (<span …>{formatSize(attachment.size)}</span>)}`;
- wrap the bar `<div className="mt-[9px] h-1 …">` as `{!link && (…)}`;
- change `{reading ? (` to `{reading && !link ? (`;
- wrap the "Primera página leída" `<div className="ch-enter …">` as `{!link && (…)}`.

- [ ] **Step 5: ErrorNotice title**

In `apps/web/src/components/ErrorNotice.tsx` change the `title` chain to:

```ts
  const title = error.kind === 'request'
    ? 'Kimi rechazó la solicitud'
    : error.kind === 'limit'
      ? 'Kimi no alcanzó a responder'
      : error.kind === 'listing'
        ? 'No pude leer el anuncio'
        : 'No pude completar el análisis';
```

`canRetry` already excludes `listing`, and "Editar la pregunta" re-seeds the composer with the URL — the retry path for a link.

- [ ] **Step 6: Conversation wiring**

In `apps/web/src/screens/Conversation.tsx`:

The `assistant-note` render branch was added in Task 7 Step 6; confirm it is still right after the `assistant-question` branch.

After the existing `{state.pendingExtraction && (<ConfirmExtraction … />)}` block add:

```tsx
      {state.pendingListing && (
        <ConfirmExtraction
          variant="anuncio"
          listing={state.pendingListing}
          onConfirm={(fields) => dispatch?.({ type: 'confirmListing', fields })}
          onCancel={() => dispatch?.({ type: 'cancelListing' })}
        />
      )}
```

`EmptyState` does not need the modal: a link is a message, and any message moves `App` to `Conversation` before the `listing` event arrives. A listing **PDF** dropped on the empty screen does reach `listingReady` there — add the same block to `apps/web/src/screens/EmptyState.tsx` after its `pendingExtraction` block, with `dispatch &&` guarding it as that file does.

- [ ] **Step 7: Run the whole web suite, typecheck and build**

Run: `pnpm --filter @chat/web test && pnpm --filter @chat/web typecheck && pnpm --filter @chat/web build`
Expected: PASS, clean, clean.

- [ ] **Step 8: Make a test bite**

In `PinnedPanel.tsx`, change `fields.some((f) => f.provenance === 'anuncio')` to `true`. Expected: "shows the page legend only while…" FAILS on the rerender. Restore, re-run: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components apps/web/src/screens
git commit -m "feat(web): 'Lo leí de la página' — listing provenance, progress and errors on screen

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: Verification, live checks and handoff

**Files:**
- Modify: `docs/HANDOFF.md`
- Modify: `docs/superpowers/specs/2026-09-11-chat-ia-fase-a-links-design.md` (only if the live run contradicts it)

- [ ] **Step 1: Full suite from the root**

Run: `pnpm -r test && pnpm -r typecheck && pnpm --filter @chat/web build`
Expected: every package green; note the new totals per package for the handoff.

- [ ] **Step 2: Browser QA — desktop**

Start both dev servers via `.claude/launch.json` (`api` and `web`). In the in-app browser at `http://localhost:5173`:

1. Paste `https://urbania.pe/inmueble/x` and send → the refusal appears in the transcript naming `urbania.pe`; the network panel shows **no** `/api/chat` call.
2. Paste `https://nexoinmobiliario.pe/departamentos/barranco/aspiria-1631` and send → progress row with the host and "Leyendo el anuncio"; then the modal: heading line with ASPIRIA · Barranco · GRUPO T&C; three radios; CTA disabled; choose TIPO 7 → Precio 363,906 and Área 41.75 fill; "Fijar estos datos" → the panel shows the three rows with emerald dots and the legend "Lo leí de la página"; the transcript shows "Fijé ubicación, precio y área del anuncio."; the Ubicación/Precio/Área capture pills are gone.
3. Paste a second Nexo link → modal again; confirm → the three rows replace; the note says so.
4. Type a price by hand in the panel, paste a link, confirm → the panel keeps the typed price and shows the listing's as a proposal.
5. Ask "¿Cuánto pagaría al mes?" → the reply comes back and the precio row is still emerald (provenance survived the envelope).

Screenshot the modal and the panel after step 2.

- [ ] **Step 3: Browser QA — mobile**

`resize_window` to the mobile preset, reload, repeat step 2. The modal must fit in 375px with the radio list readable and both buttons reachable; the bottom sheet's summary counts the three new rows. Screenshot. Reset the viewport to desktop.

- [ ] **Step 4: Manual integration — owner runs this, results recorded here**

The owner, on the deployed app after merge (or locally with a real `MOONSHOT_API_KEY`):

- Three real Nexo links, one of them single-model. For each, record: project name, district, developer, number of models offered vs on the page, and the chosen model's price and area vs the page.
- One Urbania listing saved with the browser's "Imprimir → Guardar como PDF", uploaded through the "+" control **and** dropped on the drop zone. Record: did the modal open, what filled, what was in `dudosos`.
- One bank cronograma (any of the five) uploaded again, to confirm the `tipo` change did not regress the cronograma read.

Paste the results into the handoff's Fase A section. If any of these contradicts the spec (e.g. Urbania PDFs consistently classify as `otro`), stop and report — do not tune the prompt blind.

- [ ] **Step 5: Update the handoff**

In `docs/HANDOFF.md`:
- Under "Where things stand", add a paragraph: Fase A merged (branch `fase-a-links`), what it does in three lines, the spec and plan paths, and the new test totals.
- In "Open items", add: "Fase A manual integration results: <what the owner recorded>." and "Urbania stays out of reach by design; the saved-PDF route is the fallback."
- Remove nothing else.

- [ ] **Step 6: Commit and offer the merge**

```bash
git add docs/HANDOFF.md
git commit -m "docs: record Fase A in the handoff

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

Then follow `superpowers:finishing-a-development-branch`: offer the merge of `fase-a-links` into `main`; do not push `main` without the owner's word — pushing `main` deploys the web app, and the API needs the owner's `railway up`.
