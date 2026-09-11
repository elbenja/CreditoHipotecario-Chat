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
  return v;
}

export function runDocumentPipeline(raw: string): DocumentResult {
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
  if (fields.length === 0) return { ok: false, reason: 'otro' };
  return { ok: true, kind: 'cronograma', fields };
}
