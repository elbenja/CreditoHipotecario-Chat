# Fase B — Cronograma de pagos: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let someone attach the payment schedule their bank gave them and have its terms land in the pinned panel after a confirmation step.

**Architecture:** `pdf.js` opens the PDF in the browser and reads page 1 only — extracting its text layer when there is one, rendering it to a JPEG when there is not. Only that text or image reaches the API, never the file. The API sends it to the existing Moonshot model with a synonym-carrying extraction prompt, validates the result, and returns mortgage fields that the user confirms before they pin.

**Tech Stack:** pnpm monorepo. `apps/web` React 19 + Vite 6 + Tailwind 3, `apps/api` Fastify 5 with SSE, `packages/shared` zod 3. Tests are vitest (245 passing at plan time). New runtime dependency: `pdfjs-dist` in `apps/web` only.

**Spec:** `docs/superpowers/specs/2026-09-10-chat-ia-fase-b-cronograma-design.md`

**Branch:** `fase-b-cronograma`

## Global Constraints

- Upload cap is **20 MB**, enforced in the browser before the file is opened.
- The file is **never uploaded and never stored**. Only page 1's text or rendered image leaves the device.
- **Only page 1 is read.** All five sample banks carry the condition block there.
- The extraction prompt **must** carry the per-bank synonym table. Measured on the BIF phone photo: 9/10 fields without it, 10/10 with it.
- `valorInmueble` is **always** `assumed`, never `documento` — an insured value is not a purchase price.
- Any field the model lists in `dudosos` arrives as `assumed`, not `documento`.
- The model may never claim `user` provenance on a mortgage field; the pipeline overrides it.
- `max_tokens` must be set generously on every model call. These models spend reasoning tokens before emitting content, and a tight budget returns an empty string with no error.
- All user-facing copy is Peruvian Spanish. Money is `S/ 1,750` — space after `S/`, comma for thousands.
- Real client PDFs never enter the repository.

---

## File Structure

**`packages/shared`** — types both apps depend on.
- `src/mortgage.ts` (new): mortgage key enum, field schema, the raw extraction schema the model answers with, and the down-payment derivation.
- `src/envelope.ts` (modify): `ProvenanceSchema` gains `documento`.
- `src/index.ts` (modify): re-export.

**`apps/api`** — extraction, kept pure where possible.
- `src/pipeline/document.ts` (new): raw model text → validated `MortgageField[]`. No network, no I/O.
- `src/prompt.ts` (modify): the extraction prompt and its synonym table.
- `src/kimi.ts` (modify): multimodal message content and an explicit `max_tokens`.
- `src/turn.ts` (modify): body accepts a document; branches to extraction.

**`apps/web`** — reading and UI.
- `src/pdf/readPdf.ts` (new): open, validate, probe page 1, extract text or render image.
- `src/state/chatReducer.ts` (modify): mortgage slice and its actions.
- `src/state/persistence.ts` (modify): persist the mortgage slice.
- `src/api/streamChat.ts` (modify): send the document.
- `src/components/ConfirmExtraction.tsx` (new): the confirmation modal.
- `src/components/MortgageGroup.tsx` (new): the accordion.
- `src/components/PinnedPanel.tsx` (modify): two groups, third legend dot.
- `src/components/PinnedField.tsx` (modify): third provenance state.
- `src/components/MobileBottomSheet.tsx` (modify): count both groups.
- `src/components/Composer.tsx` (modify): attach control and drop target.
- `src/screens/Conversation.tsx` (modify): wire the flow.

**`apps/api/test/fixtures/`** — redacted derivatives of the five real schedules.

---

### Task 1: Redacted fixtures

The five sample schedules carry client names, national ID numbers and loan numbers. They cannot enter the repository. This task produces redacted derivatives, and it comes first because Tasks 3 and 5 both consume them.

**Files:**
- Create: `scripts/make-fixtures.sh`
- Create: `apps/api/test/fixtures/bcp-page1.txt`, `interbank-page1.txt`
- Create: `apps/web/test/fixtures/scotia-page1.jpg`
- Create: `apps/api/test/fixtures/README.md`

**Interfaces:**
- Consumes: nothing.
- Produces: fixture files at the paths above.

- [ ] **Step 1: Write the generation script**

The source PDFs live outside the repo, in the operator's Drive. The path is machine-specific and is passed as an argument. Requires poppler (`brew install poppler`).

```bash
#!/usr/bin/env bash
# Regenerates redacted test fixtures from the real bank schedules.
# The real PDFs are NOT in this repo — they carry client PII.
# Usage: scripts/make-fixtures.sh "/path/to/Cronogramas"
set -euo pipefail
SRC="${1:?Pass the directory holding the source PDFs}"
API_FX="$(dirname "$0")/../apps/api/test/fixtures"
WEB_FX="$(dirname "$0")/../apps/web/test/fixtures"
mkdir -p "$API_FX" "$WEB_FX"

# Text-layer banks: page 1 only, then strip the identifying lines.
extract_text() {
  pdftotext -layout -f 1 -l 1 "$1" - \
    | sed -E 's/([Cc]liente[^:]*:).*/\1 [REDACTADO]/' \
    | sed -E 's/(N[uú]mero [Pp]restamo[^:]*:|Referencia[^:]*:|C\.C\.C\.[^:]*:).*/\1 [REDACTADO]/' \
    | sed -E 's/(TITULAR[^:]*:).*/\1 [REDACTADO]/'
}
extract_text "$SRC/BCP Simple CRONOGRAMA.pdf" > "$API_FX/bcp-page1.txt"
extract_text "$SRC/Interbank Simple Pepito 2 - 1. 27.02.25.pdf" > "$API_FX/interbank-page1.txt"

# Scanned bank: crop the header band off page 1, keeping the condition block.
pdftoppm -jpeg -jpegopt quality=80 -r 110 -f 1 -l 1 -y 150 -H 420 \
  "$SRC/ScotiaBank - Simple Con Degravamen.pdf" "$WEB_FX/scotia-page1"
mv "$WEB_FX/scotia-page1-1.jpg" "$WEB_FX/scotia-page1.jpg"

echo "Fixtures written. REVIEW THEM BY EYE before committing."
```

- [ ] **Step 2: Run it and inspect every output by eye**

```bash
chmod +x scripts/make-fixtures.sh
scripts/make-fixtures.sh "$HOME/My Drive/Client_Projects/CredHi/_SHARED_CreditoHipotecario/Cronogramas"
grep -iE "cliente|titular|dni|referencia|prestamo *:" apps/api/test/fixtures/*.txt
open apps/web/test/fixtures/scotia-page1.jpg
```

Expected: every hit shows `[REDACTADO]`, and the JPEG shows the condition block with no name and no reference number. **If any identifier survives, fix the script and regenerate.** A regex is not a substitute for looking.

- [ ] **Step 3: Confirm the fixtures still carry the data under test**

```bash
grep -oE "6\.99%|8\.07%|0\.52%|0\.30%|240" apps/api/test/fixtures/bcp-page1.txt | sort -u
grep -oE "283,764\.56|120 MESES" apps/api/test/fixtures/interbank-page1.txt | sort -u
```

Expected: BCP shows its TEA, TCEA, both insurance rates and its instalment count; Interbank shows its amount and term. Redaction that removes the figures under test has gone too far.

- [ ] **Step 4: Write the fixtures README**

```markdown
# Test fixtures

Redacted derivatives of five real bank payment schedules. The source PDFs are
NOT in this repository: they carry client names, national ID numbers and loan
numbers.

Regenerate with `scripts/make-fixtures.sh "<dir holding the source PDFs>"`,
then **inspect every output by eye** before committing. The script's redaction
is a regex; it is not a guarantee.

- `bcp-page1.txt`, `interbank-page1.txt` — page 1 text, identifiers replaced.
- `../../../apps/web/test/fixtures/scotia-page1.jpg` — page 1 with the header
  band cropped off, for the image route.
```

- [ ] **Step 5: Commit**

```bash
git add scripts/make-fixtures.sh apps/api/test/fixtures apps/web/test/fixtures
git commit -m "test: add redacted cronograma fixtures"
```

---

### Task 2: Shared mortgage schema

**Files:**
- Create: `packages/shared/src/mortgage.ts`
- Create: `packages/shared/src/mortgage.test.ts`
- Modify: `packages/shared/src/envelope.ts` (the `ProvenanceSchema` line)
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: `ProvenanceSchema` from `envelope.ts`.
- Produces: `MORTGAGE_KEYS`, `MortgageKey`, `MortgageFieldSchema`, `MortgageField`, `ExtractionSchema`, `Extraction`, `deriveInicial(precio, montoFinanciado)`.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/shared/src/mortgage.test.ts
import { describe, expect, it } from 'vitest';
import { ExtractionSchema, MortgageFieldSchema, deriveInicial } from './mortgage.ts';

describe('MortgageFieldSchema', () => {
  it('accepts documento provenance', () => {
    const r = MortgageFieldSchema.safeParse({
      key: 'tea', label: 'TEA', value: '8.99', suffix: '%', provenance: 'documento',
    });
    expect(r.success).toBe(true);
  });

  it('rejects a key that is not a mortgage key', () => {
    const r = MortgageFieldSchema.safeParse({
      key: 'alquiler', label: 'Alquiler', value: '1500', provenance: 'documento',
    });
    expect(r.success).toBe(false);
  });

  it('normalises a null note to empty string, like PinnedField does', () => {
    const r = MortgageFieldSchema.parse({
      key: 'cuota', label: 'Cuota', value: '2,506.00', provenance: 'documento', note: null,
    });
    expect(r.note).toBe('');
  });
});

describe('ExtractionSchema', () => {
  it('accepts the shape the model returns, with plazo as a number', () => {
    const r = ExtractionSchema.parse({
      montoFinanciado: '280,000.00', cuota: '2,506.00', tea: '8.990000 %',
      teaTipo: 'fija', tcea: '10.55 %', plazoCuotas: 360,
      seguroDesgravamen: '.048000 %', seguroInmueble: '.029000 %',
      valorInmueble: '618,382.27', totalAPagar: '902,179.33', dudosos: [],
    });
    expect(r.plazoCuotas).toBe(360);
  });

  it('defaults dudosos to an empty array when the model omits it', () => {
    expect(ExtractionSchema.parse({ tea: '6.30 %' }).dudosos).toEqual([]);
  });

  it('accepts nulls for absent fields', () => {
    expect(ExtractionSchema.parse({ tea: null, valorInmueble: null }).tea).toBeNull();
  });
});

describe('deriveInicial', () => {
  it('is the difference between price and financed amount', () => {
    expect(deriveInicial('300,000', '280,000.00')).toBe('20,000');
  });

  it('returns null when either side is missing', () => {
    expect(deriveInicial(undefined, '280,000')).toBeNull();
    expect(deriveInicial('300,000', undefined)).toBeNull();
  });

  it('returns null when the financed amount exceeds the price', () => {
    expect(deriveInicial('250,000', '280,000')).toBeNull();
  });

  it('returns null when either side is not a number', () => {
    expect(deriveInicial('caro', '280,000')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @chat/shared test`
Expected: FAIL — `Cannot find module './mortgage.ts'`.

- [ ] **Step 3: Widen the provenance enum**

In `packages/shared/src/envelope.ts`, change the one line:

```ts
export const ProvenanceSchema = z.enum(['user', 'assumed', 'market', 'documento']);
```

- [ ] **Step 4: Write the implementation**

```ts
// packages/shared/src/mortgage.ts
import { z } from 'zod';
import { ProvenanceSchema } from './envelope.ts';
import { groupFieldValue } from './format.ts';

/** The credit, as opposed to the property. Kept separate from FIELD_KEYS on
 *  purpose: sharing one flat record is what forces an enum to grow forever. */
export const MORTGAGE_KEYS = [
  'montoFinanciado',
  'cuota',
  'tea',
  'tcea',
  'plazoCuotas',
  'seguroDesgravamen',
  'seguroInmueble',
  'valorInmueble',
  'totalAPagar',
] as const;

export type MortgageKey = (typeof MORTGAGE_KEYS)[number];

export const MortgageFieldSchema = z.object({
  key: z.enum(MORTGAGE_KEYS),
  label: z.string().min(1),
  value: z.string().min(1),
  // Same nullish tolerance as PinnedField: the model sends absent or explicit
  // null interchangeably between calls.
  prefix: z.string().nullish().transform((v) => v ?? undefined),
  suffix: z.string().nullish().transform((v) => v ?? undefined),
  provenance: ProvenanceSchema,
  note: z.string().nullish().transform((v) => v ?? ''),
});

export type MortgageField = z.infer<typeof MortgageFieldSchema>;

/** What the extraction prompt asks the model to answer with. Every figure is a
 *  string because we copy what the document says rather than reinterpreting it;
 *  plazoCuotas is the exception the models keep emitting as a number. */
export const ExtractionSchema = z.object({
  montoFinanciado: z.string().nullish(),
  cuota: z.string().nullish(),
  tea: z.string().nullish(),
  teaTipo: z.enum(['fija', 'variable']).nullish(),
  tcea: z.string().nullish(),
  plazoCuotas: z.union([z.string(), z.number()]).nullish(),
  seguroDesgravamen: z.string().nullish(),
  seguroInmueble: z.string().nullish(),
  valorInmueble: z.string().nullish(),
  totalAPagar: z.string().nullish(),
  /** Fields the model did not read with confidence. Load-bearing: in testing it
   *  flagged exactly the field it got wrong. */
  dudosos: z.array(z.string()).default([]),
});

export type Extraction = z.infer<typeof ExtractionSchema>;

function toNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const bare = raw.replace(/S\/\.?/gi, '').replace(/[^\d.,-]/g, '').trim();
  if (!bare) return null;
  // Strip thousands separators, then treat any remaining comma as a decimal point.
  const n = Number(bare.replace(/[.,](?=\d{3}(?!\d))/g, '').replace(/,/g, '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * The down payment is what the buyer covers that the bank did not. Returns null
 * rather than a guess whenever the subtraction would not mean anything.
 */
export function deriveInicial(
  precio: string | undefined,
  montoFinanciado: string | undefined,
): string | null {
  const p = toNumber(precio);
  const m = toNumber(montoFinanciado);
  if (p === null || m === null) return null;
  const diff = p - m;
  if (diff <= 0) return null;
  // groupFieldValue takes a bare string and only groups plain integers.
  return groupFieldValue(String(Math.round(diff)));
}
```

- [ ] **Step 5: Export it**

In `packages/shared/src/index.ts`, add alongside the existing exports:

```ts
export * from './mortgage.ts';
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @chat/shared test`
Expected: PASS, all new tests plus the existing envelope and format suites.

- [ ] **Step 7: Confirm nothing downstream broke**

Run: `pnpm typecheck && pnpm -r test`
Expected: clean. Widening the provenance enum is additive; existing `=== 'user'` and `!== 'user'` checks keep their meaning.

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src
git commit -m "feat(shared): add mortgage field schema and documento provenance"
```

---

### Task 3: Document extraction pipeline

Pure transformation: raw model output in, validated fields out. No network.

**Files:**
- Create: `apps/api/src/pipeline/document.ts`
- Create: `apps/api/src/pipeline/document.test.ts`

**Interfaces:**
- Consumes: `ExtractionSchema`, `MortgageField`, `MORTGAGE_KEYS` from `@chat/shared`.
- Produces: `runDocumentPipeline(raw: string): DocumentResult` where
  `type DocumentResult = { ok: true; fields: MortgageField[] } | { ok: false; reason: 'noSchedule' | 'unparsable' }`.

- [ ] **Step 1: Write the failing tests**

```ts
// apps/api/src/pipeline/document.test.ts
import { describe, expect, it } from 'vitest';
import { runDocumentPipeline } from './document.ts';

const FULL = JSON.stringify({
  montoFinanciado: '280,000.00', cuota: '2,506.00', tea: '8.990000 %',
  teaTipo: 'fija', tcea: '10.55 %', plazoCuotas: 360,
  seguroDesgravamen: '.048000 %', seguroInmueble: '.029000 %',
  valorInmueble: '618,382.27', totalAPagar: '902,179.33', dudosos: [],
});

function fieldsOf(raw: string) {
  const r = runDocumentPipeline(raw);
  if (!r.ok) throw new Error(`expected ok, got ${r.reason}`);
  return Object.fromEntries(r.fields.map((f) => [f.key, f]));
}

describe('runDocumentPipeline', () => {
  it('turns a full extraction into mortgage fields', () => {
    const f = fieldsOf(FULL);
    expect(f.montoFinanciado.value).toBe('280,000.00');
    expect(f.montoFinanciado.prefix).toBe('S/');
    expect(f.tea.value).toBe('8.990000');
    expect(f.tea.suffix).toBe('%');
    expect(f.plazoCuotas.value).toBe('360');
  });

  it('marks read values as documento', () => {
    expect(fieldsOf(FULL).tea.provenance).toBe('documento');
  });

  it('always marks valorInmueble assumed — insured value is not a price', () => {
    expect(fieldsOf(FULL).valorInmueble.provenance).toBe('assumed');
  });

  it('demotes a field the model listed as dudoso', () => {
    const raw = JSON.stringify({ ...JSON.parse(FULL), dudosos: ['tcea'] });
    const f = fieldsOf(raw);
    expect(f.tcea.provenance).toBe('assumed');
    expect(f.tea.provenance).toBe('documento');
  });

  it('carries the rate type as a note, because a variable rate is indicative', () => {
    const raw = JSON.stringify({ ...JSON.parse(FULL), teaTipo: 'variable' });
    expect(fieldsOf(raw).tea.note).toMatch(/variable/i);
  });

  it('drops absent fields instead of pinning empties', () => {
    const raw = JSON.stringify({ tea: '6.30 %', cuota: null, tcea: null });
    const keys = Object.keys(fieldsOf(raw));
    expect(keys).toEqual(['tea']);
  });

  it('strips markdown fences the model sometimes adds', () => {
    expect(runDocumentPipeline('```json\n' + FULL + '\n```').ok).toBe(true);
  });

  it('reports noSchedule when nothing readable came back', () => {
    const r = runDocumentPipeline(JSON.stringify({ dudosos: [] }));
    expect(r).toEqual({ ok: false, reason: 'noSchedule' });
  });

  it('reports unparsable when the reply is not JSON', () => {
    const r = runDocumentPipeline('no pude leer el documento');
    expect(r).toEqual({ ok: false, reason: 'unparsable' });
  });

  it('never lets the model claim user provenance', () => {
    const raw = JSON.stringify({ ...JSON.parse(FULL), provenance: 'user' });
    for (const f of Object.values(fieldsOf(raw))) {
      expect(f.provenance).not.toBe('user');
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @chat/api test document`
Expected: FAIL — `Cannot find module './document.ts'`.

- [ ] **Step 3: Write the implementation**

```ts
// apps/api/src/pipeline/document.ts
import {
  ExtractionSchema,
  MortgageFieldSchema,
  type Extraction,
  type MortgageField,
  type MortgageKey,
} from '@chat/shared';

export type DocumentResult =
  | { ok: true; fields: MortgageField[] }
  | { ok: false; reason: 'noSchedule' | 'unparsable' };

interface Presentation {
  label: string;
  prefix?: string;
  suffix?: string;
}

/** How each key is shown. The unit lives in prefix/suffix, never inside value —
 *  the same rule the property panel already follows. */
const PRESENTATION: Record<MortgageKey, Presentation> = {
  montoFinanciado: { label: 'Monto financiado', prefix: 'S/' },
  cuota: { label: 'Cuota mensual', prefix: 'S/' },
  tea: { label: 'TEA', suffix: '%' },
  tcea: { label: 'TCEA', suffix: '%' },
  plazoCuotas: { label: 'Plazo', suffix: 'cuotas' },
  seguroDesgravamen: { label: 'Seguro de desgravamen', suffix: '%' },
  seguroInmueble: { label: 'Seguro del inmueble', suffix: '%' },
  valorInmueble: { label: 'Valor del inmueble', prefix: 'S/' },
  totalAPagar: { label: 'Total a pagar', prefix: 'S/' },
};

/** Models wrap JSON in fences often enough to handle it rather than fail. */
function stripFences(raw: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/.exec(raw);
  return (fenced?.[1] ?? raw).trim();
}

/** Remove a unit the model folded into the value despite the prompt. */
function bareValue(raw: string, p: Presentation): string {
  let v = raw.trim();
  if (p.prefix) v = v.replace(new RegExp(`^${p.prefix}\\.?\\s*`, 'i'), '').trim();
  if (p.suffix) v = v.replace(new RegExp(`\\s*${p.suffix}$`, 'i'), '').trim();
  return v || raw.trim();
}

export function runDocumentPipeline(raw: string): DocumentResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch {
    return { ok: false, reason: 'unparsable' };
  }

  const result = ExtractionSchema.safeParse(parsed);
  if (!result.success) return { ok: false, reason: 'unparsable' };

  const extraction: Extraction = result.data;
  const dudosos = new Set(extraction.dudosos);
  const fields: MortgageField[] = [];

  for (const key of Object.keys(PRESENTATION) as MortgageKey[]) {
    const rawValue = extraction[key];
    if (rawValue === null || rawValue === undefined) continue;

    const presentation = PRESENTATION[key];
    const value = bareValue(String(rawValue), presentation);
    if (!value) continue;

    // An insured or appraised value is not a purchase price, so it never
    // presents as read-from-the-bank however confidently the model read it.
    const alwaysAssumed = key === 'valorInmueble';
    const provenance = alwaysAssumed || dudosos.has(key) ? 'assumed' : 'documento';

    const note =
      key === 'tea' && extraction.teaTipo
        ? extraction.teaTipo === 'variable'
          ? 'Tasa variable — el cronograma es referencial, no vinculante.'
          : 'Tasa fija.'
        : alwaysAssumed
          ? 'Valor asegurado o tasación, no el precio de compra.'
          : '';

    fields.push(
      MortgageFieldSchema.parse({
        key,
        label: presentation.label,
        value,
        prefix: presentation.prefix,
        suffix: presentation.suffix,
        provenance,
        note,
      }),
    );
  }

  // Parsed cleanly but carried nothing: this was not a payment schedule.
  if (fields.length === 0) return { ok: false, reason: 'noSchedule' };
  return { ok: true, fields };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @chat/api test document`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/pipeline/document.ts apps/api/src/pipeline/document.test.ts
git commit -m "feat(api): add cronograma extraction pipeline"
```

---

### Task 4: Extraction prompt and multimodal model call

**Files:**
- Modify: `apps/api/src/prompt.ts`
- Modify: `apps/api/src/kimi.ts`
- Modify: `apps/api/src/turn.ts`
- Create: `apps/api/src/prompt.document.test.ts`
- Modify: `apps/api/src/turn.test.ts` if present, else create `apps/api/src/turn.document.test.ts`

**Interfaces:**
- Consumes: `runDocumentPipeline` from Task 3.
- Produces: `DocumentInput = { kind: 'text'; text: string } | { kind: 'image'; dataUrl: string }`, `buildDocumentMessages(doc: DocumentInput): ChatMessage[]`, and a `document` field on `ChatBody`. `runTurn` emits `event: 'extraction'` with `{ fields }` on success, or `event: 'error'` with `kind: 'document'`.

- [ ] **Step 1: Write the failing tests**

```ts
// apps/api/src/prompt.document.test.ts
import { describe, expect, it } from 'vitest';
import { buildDocumentMessages, DOCUMENT_PROMPT } from './prompt.ts';

describe('DOCUMENT_PROMPT', () => {
  // Load-bearing, not decorative: without the synonym table the model scored
  // 9/10 on the BIF photo and missed valorInmueble; with it, 10/10.
  it('names the synonyms every bank uses', () => {
    for (const s of [
      'Monto Prestamo', 'IMPORTE CONCEDIDO', 'MONTO DE CREDITO',
      'Monto Asegurado', 'Imp. Bien', 'Nro. de Cuotas', 'PLAZO TOTAL',
    ]) {
      expect(DOCUMENT_PROMPT).toContain(s);
    }
  });

  it('asks for the dudosos list', () => {
    expect(DOCUMENT_PROMPT).toContain('dudosos');
  });
});

describe('buildDocumentMessages', () => {
  it('sends text as plain content', () => {
    const m = buildDocumentMessages({ kind: 'text', text: 'TEA: 6.30 %' });
    expect(m).toHaveLength(1);
    expect(String(m[0]!.content)).toContain('TEA: 6.30 %');
  });

  it('sends an image as a content part alongside the prompt', () => {
    const m = buildDocumentMessages({ kind: 'image', dataUrl: 'data:image/jpeg;base64,AAA' });
    const parts = m[0]!.content as { type: string }[];
    expect(Array.isArray(parts)).toBe(true);
    expect(parts.map((p) => p.type)).toEqual(['text', 'image_url']);
  });
});
```

```ts
// apps/api/src/turn.document.test.ts
import { describe, expect, it } from 'vitest';
import { parseChatBody, runTurn } from './turn.ts';

const EXTRACTION = JSON.stringify({ tea: '6.30 %', cuota: '3,051.10', dudosos: [] });

async function collect(body: Parameters<typeof runTurn>[0], reply: string) {
  const out = [];
  for await (const e of runTurn(body, async () => ({ content: reply, truncated: false }))) {
    out.push(e);
  }
  return out;
}

describe('document turns', () => {
  it('accepts a body carrying a document', () => {
    const b = parseChatBody({
      messages: [{ role: 'user', content: 'te mando mi cronograma' }],
      document: { kind: 'text', text: 'TEA: 6.30 %' },
    });
    expect(b?.document?.kind).toBe('text');
  });

  it('rejects a document with neither text nor a data URL', () => {
    expect(parseChatBody({
      messages: [{ role: 'user', content: 'x' }],
      document: { kind: 'image', dataUrl: 'https://evil.example/x.jpg' },
    })).toBeNull();
  });

  it('emits an extraction event with the read fields', async () => {
    const events = await collect(
      { messages: [{ role: 'user', content: 'mi cronograma' }], fields: [],
        document: { kind: 'text', text: 'TEA 6.30' } },
      EXTRACTION,
    );
    const extraction = events.find((e) => e.event === 'extraction');
    expect(extraction).toBeDefined();
    const data = extraction!.data as { fields: { key: string }[] };
    expect(data.fields.map((f) => f.key).sort()).toEqual(['cuota', 'tea']);
  });

  it('emits a document error when the reply is not a schedule', async () => {
    const events = await collect(
      { messages: [{ role: 'user', content: 'mi cronograma' }], fields: [],
        document: { kind: 'text', text: 'una receta de causa' } },
      JSON.stringify({ dudosos: [] }),
    );
    const err = events.find((e) => e.event === 'error');
    expect((err!.data as { kind: string }).kind).toBe('document');
    expect((err!.data as { message: string }).message).toMatch(/cronograma/i);
  });

  it('does not run the out-of-scope guardrail on a document turn', async () => {
    // The user message accompanying an upload is often bare or odd; the
    // document is the payload, so the text guardrail must not eat the turn.
    const events = await collect(
      { messages: [{ role: 'user', content: 'bitcoin' }], fields: [],
        document: { kind: 'text', text: 'TEA 6.30' } },
      EXTRACTION,
    );
    expect(events.some((e) => e.event === 'extraction')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @chat/api test`
Expected: FAIL — `buildDocumentMessages` is not exported, `document` is not on the body.

- [ ] **Step 3: Add the prompt**

Append to `apps/api/src/prompt.ts`:

```ts
export type DocumentInput =
  | { kind: 'text'; text: string }
  | { kind: 'image'; dataUrl: string };

/**
 * Every bank names the same figure differently, so the synonyms are part of the
 * contract rather than a hint. Measured on the BIF phone photo: 9/10 fields
 * without this table, 10/10 with it.
 */
export const DOCUMENT_PROMPT = `Esta es la primera página de un cronograma de pagos de un banco peruano. Extrae las condiciones del crédito.

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

Responde ÚNICAMENTE con este JSON, sin texto alrededor y sin bloques de markdown:
{"montoFinanciado":null,"cuota":null,"tea":null,"teaTipo":"fija|variable","tcea":null,"plazoCuotas":null,"seguroDesgravamen":null,"seguroInmueble":null,"valorInmueble":null,"totalAPagar":null,"dudosos":[]}

REGLAS
- Copia las cifras EXACTAMENTE como aparecen, con sus comas y decimales. No las conviertas ni las redondees.
- Usa null en cada campo que el documento no traiga. No inventes.
- "dudosos": la lista de los campos que NO leíste con certeza. Es mejor declarar una duda que acertar por casualidad.
- Si el documento no es un cronograma de pagos, devuelve todos los campos en null.`;

export function buildDocumentMessages(doc: DocumentInput): ChatMessage[] {
  if (doc.kind === 'text') {
    return [{ role: 'user', content: `${DOCUMENT_PROMPT}\n\n---\n${doc.text}` }];
  }
  return [
    {
      role: 'user',
      content: [
        { type: 'text', text: DOCUMENT_PROMPT },
        { type: 'image_url', image_url: { url: doc.dataUrl } },
      ],
    },
  ];
}
```

Widen `ChatMessage` in the same file so image parts type-check:

```ts
export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}
```

- [ ] **Step 4: Set an explicit token ceiling on the model call**

In `apps/api/src/kimi.ts`, inside `chat.completions.create`, add `max_tokens` and drop the JSON-object response format for document turns — image turns reason before answering, and a tight ceiling returns an empty string with **no error**, which reads as "the model cannot see images". This cost a wrong conclusion once already.

```ts
  const res = await getClient().chat.completions.create({
    model: MODEL,
    messages: messages as never,
    // Generous on purpose: these models spend reasoning tokens before emitting
    // any content. Measured on a page-1 crop: ~2,200 completion tokens, almost
    // all of them reasoning. A low ceiling yields '' and no error at all.
    max_tokens: 4000,
    response_format: { type: 'json_object' },
  });
```

- [ ] **Step 5: Branch the turn**

In `apps/api/src/turn.ts`, extend the body schema and add the branch. Place the branch **before** the out-of-scope guardrail: on an upload the message text is incidental, and the guardrail would swallow the turn.

```ts
const DocumentSchema = z.union([
  z.object({ kind: z.literal('text'), text: z.string().min(1) }),
  z.object({
    kind: z.literal('image'),
    // Data URLs only. A remote URL would make the API fetch whatever a caller
    // names, which is not something this endpoint should ever do.
    dataUrl: z.string().regex(/^data:image\/(jpeg|png);base64,/),
  }),
]);

const BodySchema = z.object({
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })).min(1),
  fields: z.array(PinnedFieldSchema).default([]),
  document: DocumentSchema.optional(),
});
```

Then, immediately after the first `yield { event: 'status', data: { phase: 'thinking' } }`:

```ts
  if (body.document) {
    yield { event: 'analyzeStep', data: { label: 'Leyendo el cronograma' } };
    yield { event: 'status', data: { phase: 'analyzing' } };
    try {
      const { content } = await callModel(buildDocumentMessages(body.document));
      const result = runDocumentPipeline(content);
      yield { event: 'status', data: { phase: 'streaming' } };
      if (result.ok) {
        yield { event: 'extraction', data: { fields: result.fields } };
      } else {
        yield {
          event: 'error',
          data: {
            kind: 'document',
            message:
              result.reason === 'noSchedule'
                ? 'Esto no parece un cronograma de pagos. Revisa que sea la primera página.'
                : 'No pude leer las condiciones de ese cronograma.',
          },
        };
      }
    } catch (err) {
      console.error('[chat] document extraction failed:', err);
      yield {
        event: 'error',
        data: { kind: 'api', message: 'Se cayó la conexión con el modelo. Tus datos siguen acá.' },
      };
    }
    return;
  }
```

Add the imports `buildDocumentMessages` and `runDocumentPipeline` at the top.

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @chat/api test`
Expected: PASS, including the pre-existing chat route and scope suites.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src
git commit -m "feat(api): accept a cronograma and extract its terms"
```

---

### Task 5: Browser PDF reader

**Files:**
- Create: `apps/web/src/pdf/readPdf.ts`
- Create: `apps/web/src/pdf/readPdf.test.ts`
- Modify: `apps/web/package.json`
- Modify: `apps/web/vite.config.ts` if the worker needs it

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `MAX_BYTES`, `PdfReadError` with `code: 'notPdf' | 'encrypted' | 'tooLarge' | 'unreadable'`, and `readFirstPage(file: File): Promise<DocumentInput>` returning the same shape the API accepts.

- [ ] **Step 1: Install the dependency**

```bash
pnpm --filter @chat/web add pdfjs-dist@4.10.38
```

`pdfjs-dist` needs its worker resolved explicitly under Vite. Set it once at module load with `import.meta.url`, as shown in the implementation — leaving it unset makes the reader hang with no error.

- [ ] **Step 2: Write the failing tests**

```ts
// apps/web/src/pdf/readPdf.test.ts
import { describe, expect, it, vi } from 'vitest';
import { MAX_BYTES, PdfReadError, readFirstPage } from './readPdf.ts';

function fakeFile(name: string, type: string, bytes: number): File {
  const f = new File([new Uint8Array(1)], name, { type });
  Object.defineProperty(f, 'size', { value: bytes });
  return f;
}

describe('readFirstPage guards', () => {
  it('rejects a file that is not a PDF before opening it', async () => {
    await expect(readFirstPage(fakeFile('foto.png', 'image/png', 1000)))
      .rejects.toMatchObject({ code: 'notPdf' });
  });

  it('rejects a file over the 20MB cap', async () => {
    await expect(readFirstPage(fakeFile('grande.pdf', 'application/pdf', MAX_BYTES + 1)))
      .rejects.toMatchObject({ code: 'tooLarge' });
  });

  it('caps at 20MB', () => {
    expect(MAX_BYTES).toBe(20 * 1024 * 1024);
  });

  it('reports encrypted PDFs distinctly, so the message can be useful', () => {
    const e = new PdfReadError('encrypted');
    expect(e.code).toBe('encrypted');
    expect(e).toBeInstanceOf(Error);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @chat/web test readPdf`
Expected: FAIL — `Cannot find module './readPdf.ts'`.

- [ ] **Step 4: Write the implementation**

```ts
// apps/web/src/pdf/readPdf.ts
import * as pdfjs from 'pdfjs-dist';

// Vite needs the worker resolved explicitly. Without this the reader hangs
// with no error at all, which is worse than failing.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export const MAX_BYTES = 20 * 1024 * 1024;

/** Below this, page 1 has no usable text layer and we render it instead.
 *  The two text-layer banks give ~4,500 characters; the scans give ~1. */
const TEXT_LAYER_MIN = 200;

/** Wide enough for the model to read a dot-matrix schedule, small enough to
 *  keep the payload modest. A page-1 crop at this width cost 645 prompt tokens. */
const RENDER_WIDTH = 1200;

export type DocumentInput =
  | { kind: 'text'; text: string }
  | { kind: 'image'; dataUrl: string };

export type PdfErrorCode = 'notPdf' | 'encrypted' | 'tooLarge' | 'unreadable';

export class PdfReadError extends Error {
  constructor(readonly code: PdfErrorCode) {
    super(code);
    this.name = 'PdfReadError';
  }
}

/**
 * Reads page 1 and only page 1: all five sample banks carry the condition block
 * there, so the rest of the document is the amortisation table repeating.
 * The file itself never leaves the browser.
 */
export async function readFirstPage(file: File): Promise<DocumentInput> {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new PdfReadError('notPdf');
  }
  if (file.size > MAX_BYTES) throw new PdfReadError('tooLarge');

  let doc: pdfjs.PDFDocumentProxy;
  try {
    doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  } catch (err) {
    const name = (err as { name?: string })?.name;
    throw new PdfReadError(name === 'PasswordException' ? 'encrypted' : 'unreadable');
  }

  try {
    const page = await doc.getPage(1);
    const content = await page.getTextContent();
    const text = content.items
      .map((i) => ('str' in i ? i.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (text.length >= TEXT_LAYER_MIN) return { kind: 'text', text };

    // No text layer: it is a scan or a photo, so render it and let the model read it.
    const viewport = page.getViewport({ scale: 1 });
    const scale = RENDER_WIDTH / viewport.width;
    const scaled = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(scaled.width);
    canvas.height = Math.ceil(scaled.height);
    const canvasContext = canvas.getContext('2d');
    if (!canvasContext) throw new PdfReadError('unreadable');
    await page.render({ canvasContext, viewport: scaled }).promise;
    return { kind: 'image', dataUrl: canvas.toDataURL('image/jpeg', 0.8) };
  } catch (err) {
    if (err instanceof PdfReadError) throw err;
    throw new PdfReadError('unreadable');
  } finally {
    void doc.destroy();
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @chat/web test readPdf`
Expected: PASS, 4 tests. The guard tests run in jsdom without touching pdf.js internals; the render path is exercised by hand in Task 9's manual check, because jsdom has no canvas.

- [ ] **Step 6: Confirm the build still works**

Run: `pnpm --filter @chat/web build`
Expected: clean. If the worker fails to resolve, the build is where it shows.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/pdf apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): read page 1 of a PDF in the browser"
```

---

### Task 6: Mortgage state

**Files:**
- Modify: `apps/web/src/state/chatReducer.ts`
- Modify: `apps/web/src/state/persistence.ts`
- Modify: `apps/web/src/state/chatReducer.test.ts`

**Interfaces:**
- Consumes: `MortgageField`, `deriveInicial` from `@chat/shared`.
- Produces: on `ChatState` — `mortgage: Record<string, MortgageField>` and `pendingExtraction: MortgageField[] | null`. New actions: `{ type: 'extractionReady'; fields: MortgageField[] }`, `{ type: 'confirmExtraction'; fields: MortgageField[] }`, `{ type: 'cancelExtraction' }`.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/src/state/chatReducer.test.ts`, following the file's existing `reduce`/initial-state helpers:

```ts
describe('cronograma extraction', () => {
  const READ: MortgageField[] = [
    { key: 'tea', label: 'TEA', value: '8.99', suffix: '%', provenance: 'documento', note: '' },
    { key: 'montoFinanciado', label: 'Monto financiado', value: '280,000', prefix: 'S/',
      provenance: 'documento', note: '' },
  ];

  it('holds the read fields pending, without pinning them', () => {
    const s = reduce(initial(), { type: 'extractionReady', fields: READ });
    expect(s.pendingExtraction).toHaveLength(2);
    expect(s.mortgage).toEqual({});
  });

  it('pins them on confirm and clears the pending set', () => {
    let s = reduce(initial(), { type: 'extractionReady', fields: READ });
    s = reduce(s, { type: 'confirmExtraction', fields: READ });
    expect(s.mortgage.tea!.value).toBe('8.99');
    expect(s.pendingExtraction).toBeNull();
  });

  it('pins what the user edited in the modal, not what was read', () => {
    let s = reduce(initial(), { type: 'extractionReady', fields: READ });
    const corrected = [{ ...READ[0]!, value: '9.10' }, READ[1]!];
    s = reduce(s, { type: 'confirmExtraction', fields: corrected });
    expect(s.mortgage.tea!.value).toBe('9.10');
  });

  it('pins nothing on cancel', () => {
    let s = reduce(initial(), { type: 'extractionReady', fields: READ });
    s = reduce(s, { type: 'cancelExtraction' });
    expect(s.mortgage).toEqual({});
    expect(s.pendingExtraction).toBeNull();
  });

  it('derives the down payment when the panel already holds a price', () => {
    let s = initial();
    s = { ...s, fields: { ...s.fields, precio: {
      key: 'precio', label: 'Precio', value: '300,000', prefix: 'S/',
      provenance: 'user', note: '' } } };
    s = reduce(s, { type: 'confirmExtraction', fields: READ });
    expect(s.fields.inicial?.value).toBe('20,000');
    expect(s.fields.inicial?.provenance).toBe('assumed');
  });

  it('does not invent a down payment when there is no price', () => {
    const s = reduce(initial(), { type: 'confirmExtraction', fields: READ });
    expect(s.fields.inicial).toBeUndefined();
  });

  it('never overwrites a down payment the user typed', () => {
    let s = initial();
    s = { ...s, fields: { ...s.fields,
      precio: { key: 'precio', label: 'Precio', value: '300,000', prefix: 'S/',
        provenance: 'user', note: '' },
      inicial: { key: 'inicial', label: 'Inicial', value: '45,000', prefix: 'S/',
        provenance: 'user', note: '' } },
      userEdited: ['inicial'] };
    s = reduce(s, { type: 'confirmExtraction', fields: READ });
    expect(s.fields.inicial!.value).toBe('45,000');
  });

  it('clears the mortgage group on reset', () => {
    let s = reduce(initial(), { type: 'confirmExtraction', fields: READ });
    s = reduce(s, { type: 'reset' });
    expect(s.mortgage).toEqual({});
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @chat/web test chatReducer`
Expected: FAIL — `pendingExtraction` is not on the state, the actions are unknown.

- [ ] **Step 3: Extend the state and actions**

In `apps/web/src/state/chatReducer.ts`, add to `ChatState`:

```ts
  /** Credit terms read from an uploaded schedule. Separate from `fields`:
   *  those describe the property, these describe the credit. */
  mortgage: Record<string, MortgageField>;
  /** Read but not yet confirmed. Nothing pins until the user says so. */
  pendingExtraction: MortgageField[] | null;
```

Add to the `Action` union:

```ts
  | { type: 'extractionReady'; fields: MortgageField[] }
  | { type: 'confirmExtraction'; fields: MortgageField[] }
  | { type: 'cancelExtraction' }
```

Initialise both in the initial state (`mortgage: {}`, `pendingExtraction: null`) and clear both in the `reset` case.

- [ ] **Step 4: Write the reducer cases**

```ts
    case 'extractionReady':
      return { ...state, pendingExtraction: action.fields, status: 'idle' };

    case 'cancelExtraction':
      return { ...state, pendingExtraction: null };

    case 'confirmExtraction': {
      const mortgage = { ...state.mortgage };
      for (const f of action.fields) mortgage[f.key] = f;

      // The down payment is what the buyer covers that the bank did not, so it
      // falls out of the two numbers. Never over a value the user owns.
      const fields = { ...state.fields };
      const financed = mortgage.montoFinanciado?.value;
      const inicial = deriveInicial(fields.precio?.value, financed);
      if (inicial && !state.userEdited.includes('inicial')) {
        fields.inicial = {
          key: 'inicial',
          label: 'Inicial',
          value: inicial,
          prefix: 'S/',
          // Derived, not read: the schedule never states a down payment.
          provenance: 'assumed',
          note: 'Calculada: precio menos el monto que financia el banco.',
        };
      }

      return { ...state, mortgage, fields, pendingExtraction: null };
    }
```

Import `deriveInicial` and `type MortgageField` from `@chat/shared` at the top.

- [ ] **Step 5: Persist the mortgage slice**

In `apps/web/src/state/persistence.ts`, add `mortgage` wherever `fields` is serialised and rehydrated. Leave `pendingExtraction` out — an unconfirmed read must not survive a reload.

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @chat/web test`
Expected: PASS, including the existing persistence suite.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/state
git commit -m "feat(web): hold and confirm cronograma extractions"
```

---

### Task 7: Confirmation modal

**Files:**
- Create: `apps/web/src/components/ConfirmExtraction.tsx`
- Create: `apps/web/src/components/ConfirmExtraction.test.tsx`

**Interfaces:**
- Consumes: `MortgageField` from `@chat/shared`.
- Produces: `<ConfirmExtraction fields onConfirm onCancel />` where `onConfirm: (fields: MortgageField[]) => void`.

- [ ] **Step 1: Write the failing tests**

```tsx
// apps/web/src/components/ConfirmExtraction.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { MortgageField } from '@chat/shared';
import { ConfirmExtraction } from './ConfirmExtraction';

const FIELDS: MortgageField[] = [
  { key: 'tea', label: 'TEA', value: '8.99', suffix: '%', provenance: 'documento', note: '' },
  { key: 'tcea', label: 'TCEA', value: '10.55', suffix: '%', provenance: 'assumed', note: '' },
];

describe('ConfirmExtraction', () => {
  it('warns that a confident-looking digit can still be wrong', () => {
    render(<ConfirmExtraction fields={FIELDS} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('dialog')).toHaveTextContent(/puede leer mal/i);
  });

  it('marks the uncertain fields so they get looked at first', () => {
    render(<ConfirmExtraction fields={FIELDS} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText('TCEA')).toHaveAttribute('data-dudoso', 'true');
    expect(screen.getByLabelText('TEA')).toHaveAttribute('data-dudoso', 'false');
  });

  it('confirms with the edited values, not the read ones', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmExtraction fields={FIELDS} onConfirm={onConfirm} onCancel={vi.fn()} />);
    const tea = screen.getByLabelText('TEA');
    await userEvent.clear(tea);
    await userEvent.type(tea, '9.10');
    await userEvent.click(screen.getByRole('button', { name: /fijar/i }));
    expect(onConfirm.mock.calls[0]![0][0].value).toBe('9.10');
  });

  it('cancels without confirming', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmExtraction fields={FIELDS} onConfirm={onConfirm} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: /descartar/i }));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('closes on Escape', async () => {
    const onCancel = vi.fn();
    render(<ConfirmExtraction fields={FIELDS} onConfirm={vi.fn()} onCancel={onCancel} />);
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalled();
  });

  it('is a modal dialog', () => {
    render(<ConfirmExtraction fields={FIELDS} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @chat/web test ConfirmExtraction`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

```tsx
// apps/web/src/components/ConfirmExtraction.tsx
import { useEffect, useState } from 'react';
import type { MortgageField } from '@chat/shared';

/**
 * The read is shown before it pins. Its job is not ceremony: a digit read off a
 * photo can be wrong and still look confident, and it would land in the field
 * the whole analysis is built on.
 */
export function ConfirmExtraction({
  fields,
  onConfirm,
  onCancel,
}: {
  fields: MortgageField[];
  onConfirm: (fields: MortgageField[]) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(fields);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const edit = (key: string, value: string) =>
    setDraft((d) => d.map((f) => (f.key === key ? { ...f, value } : f)));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Revisar lo que leí del cronograma"
        className="ch-rise max-h-[85vh] w-full max-w-[440px] overflow-y-auto rounded-xl border border-ch-border bg-ch-panel p-5"
      >
        <h2 className="font-jakarta text-[19px] font-extrabold tracking-[-.02em] text-white">
          Esto leí de tu cronograma
        </h2>
        <p className="mt-2 text-[12.5px] leading-[1.6] text-slate-400">
          Dale una mirada antes de fijarlo. Puede leer mal un dígito y verse igual
          de seguro, y estas cifras son la base de todo lo que calcule después.
        </p>

        <div className="mt-4 flex flex-col gap-[10px]">
          {draft.map((f) => {
            const dudoso = f.provenance !== 'documento';
            return (
              <div
                key={f.key}
                className={`rounded-[10px] border px-3 py-[10px] ${
                  dudoso ? 'border-ch-accent' : 'border-ch-border'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-500">
                    {f.label}
                  </span>
                  {dudoso && (
                    <span className="text-[10px] font-semibold text-ch-accent">revisa este</span>
                  )}
                </div>
                <div className="mt-[6px] flex items-baseline gap-[5px]">
                  {f.prefix && <span className="text-[14px] font-bold text-slate-500">{f.prefix}</span>}
                  <input
                    value={f.value}
                    onChange={(e) => edit(f.key, e.target.value)}
                    aria-label={f.label}
                    data-dudoso={dudoso}
                    className="tnum min-w-0 flex-1 border-none bg-transparent p-0 font-jakarta text-[17px] font-bold tracking-[-.02em] text-white outline-none"
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
            onClick={() => onConfirm(draft)}
            className="h-[44px] flex-1 rounded-full bg-slate-50 text-[13.5px] font-semibold text-ch-bg transition-opacity duration-120 ease-ch hover:opacity-90 active:translate-y-px"
          >
            Fijar estos datos
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @chat/web test ConfirmExtraction`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ConfirmExtraction.tsx apps/web/src/components/ConfirmExtraction.test.tsx
git commit -m "feat(web): confirm what was read before pinning it"
```

---

### Task 8: Panel grouping

**Files:**
- Create: `apps/web/src/components/MortgageGroup.tsx`
- Create: `apps/web/src/components/MortgageGroup.test.tsx`
- Modify: `apps/web/src/components/PinnedPanel.tsx`
- Modify: `apps/web/src/components/PinnedField.tsx`
- Modify: `apps/web/src/components/MobileBottomSheet.tsx`

**Interfaces:**
- Consumes: `MortgageField`.
- Produces: `<MortgageGroup fields onEdit />`. `PinnedPanel` gains a `mortgage: MortgageField[]` prop, defaulting to `[]` so existing call sites keep working.

- [ ] **Step 1: Write the failing tests**

```tsx
// apps/web/src/components/MortgageGroup.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { MortgageField } from '@chat/shared';
import { MortgageGroup } from './MortgageGroup';

const make = (n: number): MortgageField[] =>
  Array.from({ length: n }, (_, i) => ({
    key: `k${i}`, label: `Campo ${i}`, value: String(i),
    provenance: 'documento' as const, note: '',
  }));

describe('MortgageGroup', () => {
  it('renders nothing when there is no mortgage', () => {
    const { container } = render(<MortgageGroup fields={[]} onEdit={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('starts open at four fields or fewer', () => {
    render(<MortgageGroup fields={make(4)} onEdit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /tu hipoteca/i })).toHaveAttribute('aria-expanded', 'true');
  });

  it('starts collapsed past four, so it does not bury the property', () => {
    render(<MortgageGroup fields={make(5)} onEdit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /tu hipoteca/i })).toHaveAttribute('aria-expanded', 'false');
  });

  it('toggles', async () => {
    render(<MortgageGroup fields={make(5)} onEdit={vi.fn()} />);
    const toggle = screen.getByRole('button', { name: /tu hipoteca/i });
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows the count while collapsed', () => {
    render(<MortgageGroup fields={make(5)} onEdit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /tu hipoteca/i })).toHaveTextContent('5');
  });
});
```

Append to `apps/web/src/components/TopNav.test.tsx`'s sibling suite for the panel, or create `PinnedPanel.test.tsx`:

```tsx
it('shows the third legend state once something was read from a document', () => {
  render(<PinnedPanel fields={[]} mortgage={[{
    key: 'tea', label: 'TEA', value: '8.99', provenance: 'documento', note: '',
  }]} onEdit={vi.fn()} />);
  expect(screen.getByText(/lo leí del banco/i)).toBeInTheDocument();
});

it('hides that legend state when nothing came from a document', () => {
  render(<PinnedPanel fields={[]} onEdit={vi.fn()} />);
  expect(screen.queryByText(/lo leí del banco/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @chat/web test MortgageGroup`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the accordion**

```tsx
// apps/web/src/components/MortgageGroup.tsx
import { useState } from 'react';
import type { MortgageField } from '@chat/shared';
import { PinnedFieldRow } from './PinnedField';
import { Icon } from './Icon';

/** Past this many rows the group would bury the property fields, so it starts shut. */
const COLLAPSE_ABOVE = 4;

export function MortgageGroup({
  fields,
  onEdit,
}: {
  fields: MortgageField[];
  onEdit: (key: string, value: string) => void;
}) {
  const [open, setOpen] = useState(fields.length <= COLLAPSE_ABOVE);
  if (fields.length === 0) return null;

  return (
    <div className="mt-2 border-t border-ch-border pt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-[9px] text-left"
      >
        <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-500">
          Tu hipoteca
        </span>
        <span className="text-[11px] font-medium text-slate-400">{fields.length}</span>
        <div className="flex-1" />
        <Icon
          name={open ? 'arrow-up-01' : 'arrow-down-01'}
          size={15}
          className="text-ch-border-hover"
        />
      </button>
      {open && fields.map((f) => (
        <PinnedFieldRow key={f.key} field={f} onChange={onEdit} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Teach the field row the third state**

In `apps/web/src/components/PinnedField.tsx`, replace the two-state dot. The existing comment explains why the test is `!== 'user'`; keep that reasoning and add the document case above it.

```tsx
  // Provenance is the whole point. A value read off the bank's own schedule is
  // firmer than anything the user recalled, so it gets its own mark rather than
  // being folded into either existing state.
  const fromDocument = field.provenance === 'documento';
  const notFromUser = field.provenance !== 'user' && !fromDocument;

  const dotClass = fromDocument ? 'bg-emerald-400' : notFromUser ? 'bg-ch-accent' : 'bg-slate-400';
  const dotTitle = fromDocument ? 'Lo leí del banco' : notFromUser ? 'Lo asumí yo' : 'Lo dijiste tú';
```

and use `dotClass` / `dotTitle` on the existing dot span.

- [ ] **Step 5: Render both groups in the panel**

In `apps/web/src/components/PinnedPanel.tsx`: add `mortgage = []` to the props (typed `MortgageField[]`), render `<MortgageGroup fields={mortgage} onEdit={onEdit} />` after the property rows and before `<SavedScenarios />`, and add the third legend entry rendered only when `mortgage.some((f) => f.provenance === 'documento')`:

```tsx
          {mortgage.some((f) => f.provenance === 'documento') && (
            <span className="flex items-center gap-[6px] text-[11px] font-medium text-emerald-400">
              <span className="h-[7px] w-[7px] rounded-full bg-emerald-400" />
              Lo leí del banco
            </span>
          )}
```

- [ ] **Step 6: Count both groups in the mobile summary**

In `apps/web/src/components/MobileBottomSheet.tsx`, accept `mortgage: MortgageField[] = []`, pass it through to `PinnedPanel`, and change the collapsed summary count from `fields.length` to `fields.length + mortgage.length`.

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm --filter @chat/web test`
Expected: PASS, including the existing `MobileBottomSheet` suite.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components
git commit -m "feat(web): group the mortgage in the panel behind an accordion"
```

---

### Task 9: Attach, wire, verify

**Files:**
- Modify: `apps/web/src/components/Composer.tsx`
- Modify: `apps/web/src/api/streamChat.ts`
- Modify: `apps/web/src/screens/Conversation.tsx`
- Modify: `apps/web/src/components/Composer.test.tsx`

**Interfaces:**
- Consumes: everything from Tasks 5–8.
- Produces: the working feature.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/src/components/Composer.test.tsx`:

```tsx
describe('attaching a cronograma', () => {
  it('offers an attach control', () => {
    render(<Composer value="" onChange={vi.fn()} onSubmit={vi.fn()} placeholder="x"
      onAttach={vi.fn()} />);
    expect(screen.getByLabelText(/adjuntar cronograma/i)).toBeInTheDocument();
  });

  it('hands the chosen file up', async () => {
    const onAttach = vi.fn();
    render(<Composer value="" onChange={vi.fn()} onSubmit={vi.fn()} placeholder="x"
      onAttach={onAttach} />);
    const file = new File([new Uint8Array(1)], 'cronograma.pdf', { type: 'application/pdf' });
    await userEvent.upload(screen.getByTestId('attach-input'), file);
    expect(onAttach).toHaveBeenCalledWith(file);
  });

  it('says what happens to the document, since every schedule carries personal data', () => {
    render(<Composer value="" onChange={vi.fn()} onSubmit={vi.fn()} placeholder="x"
      onAttach={vi.fn()} />);
    expect(screen.getByLabelText(/adjuntar cronograma/i))
      .toHaveAttribute('title', expect.stringMatching(/no se sube|primera página/i));
  });

  it('has no attach control when the screen does not pass one', () => {
    render(<Composer value="" onChange={vi.fn()} onSubmit={vi.fn()} placeholder="x" />);
    expect(screen.queryByLabelText(/adjuntar cronograma/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @chat/web test Composer`
Expected: FAIL — no attach control.

- [ ] **Step 3: Add the attach control**

In `apps/web/src/components/Composer.tsx`, add an optional `onAttach?: (file: File) => void` prop. When it is present, render a hidden file input plus its button in the active variant's button row:

```tsx
      {onAttach && (
        <>
          <input
            type="file"
            accept="application/pdf"
            data-testid="attach-input"
            className="hidden"
            ref={fileRef}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onAttach(f);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Adjuntar cronograma"
            title="Leo solo la primera página. El archivo no se sube ni se guarda. Puedes tapar tus datos personales antes."
            className="grid h-[34px] w-[34px] flex-none place-items-center rounded-full text-slate-400 transition-colors duration-180 ease-ch hover:text-slate-200"
          >
            <Icon name="attachment-01" size={17} />
          </button>
        </>
      )}
```

Add `const fileRef = useRef<HTMLInputElement>(null);` beside the existing `boxRef`.

`Icon` has no name enum to extend — it renders `hgi-stroke hgi-${name}` from a webfont, so any HugeIcons name works. Check that `attachment-01` and `arrow-down-01` (Task 8) actually render rather than showing a blank glyph; if either does not, pick a name that exists in the loaded set.

- [ ] **Step 4: Send the document**

In `apps/web/src/api/streamChat.ts`, add `document?: DocumentInput` to `ChatRequest`. It is already serialised by `JSON.stringify(body)`, so nothing else changes.

- [ ] **Step 5: Wire the screen**

In `apps/web/src/screens/Conversation.tsx`: on attach, call `readFirstPage(file)`, catch `PdfReadError` and dispatch the matching Spanish error, then `streamChat` with the document and dispatch `extractionReady` on the `extraction` event. Render `<ConfirmExtraction />` when `state.pendingExtraction` is non-null, wiring its callbacks to `confirmExtraction` / `cancelExtraction`. Pass `state.mortgage` values into `PinnedPanel` and `MobileBottomSheet`.

Map the reader's codes to copy:

```ts
const PDF_ERRORS: Record<PdfErrorCode, string> = {
  notPdf: 'Eso no es un PDF. Sube el cronograma que te dio el banco.',
  tooLarge: 'Ese archivo pasa los 20 MB. Sube solo el cronograma.',
  encrypted: 'Ese PDF tiene contraseña y no puedo abrirlo.',
  unreadable: 'No pude leer ese PDF.',
};
```

- [ ] **Step 6: Run the whole suite**

Run: `pnpm -r test && pnpm typecheck && pnpm --filter @chat/web build`
Expected: all green, 245 pre-existing tests still passing plus the new ones.

- [ ] **Step 7: Verify against the real schedules by hand**

The image route cannot be asserted in jsdom — there is no canvas — and model output is not deterministic. Run the dev server and upload all five real PDFs from the operator's Drive, one at a time.

Score each field against the values recorded in the design spec and session notes. The BIF photo is the benchmark: it read 10/10 during design. Note any field that comes back wrong or absent, and whether the model flagged it in `dudosos` — a wrong field that was *not* flagged is the failure mode that matters, because the modal will not highlight it.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): attach a cronograma and pin its terms"
```

---

## Self-Review

**Spec coverage.** Goal → Tasks 5–9. Page-1-only → Task 5. Text and image routes → Tasks 4, 5. Synonym table → Task 4 Step 3, asserted. `dudosos` → Tasks 3, 7. `valorInmueble` always assumed → Task 3, asserted. No `user` provenance on mortgage fields → Task 3, asserted. `enforceProvenance` not applied → satisfied by construction: `runDocumentPipeline` is a separate path that never calls it. Down-payment derivation → Tasks 2, 6. Data model → Task 2. Accordion, third legend state, mobile count → Task 8. Errors and the 20 MB cap → Tasks 5, 9. Privacy notice → Task 9 Step 3, asserted. Confirmation modal and its warning → Task 7, asserted. Redacted fixtures → Task 1. `max_tokens` → Task 4 Step 4.

**Placeholders.** None. Every code step carries the code.

**Type consistency.** `DocumentInput` is declared in `apps/api/src/prompt.ts` (Task 4) and again in `apps/web/src/pdf/readPdf.ts` (Task 5) — deliberately, since the two packages do not import each other, and the shapes are asserted identical by the API's body schema. `MortgageField`, `MORTGAGE_KEYS`, `ExtractionSchema` and `deriveInicial` all originate in Task 2 and keep their names throughout. `runDocumentPipeline`'s `DocumentResult` matches its use in Task 4. `readFirstPage`, `PdfReadError` and `PdfErrorCode` match between Tasks 5 and 9. `extractionReady` / `confirmExtraction` / `cancelExtraction` match between Tasks 6, 7 and 9.

**Gap found and closed.** The spec's error list covers a failed extraction call but the first draft of Task 4 had no catch around it; the `try/catch` in Step 5 was added so a network failure lands on the existing Spanish error path rather than killing the stream.
