import {
  ExtractionSchema,
  MortgageFieldSchema,
  type Extraction,
  type Listing,
  type MortgageField,
  type MortgageKey,
} from '@chat/shared';
import { COPY, type Lang } from '../i18n.ts';
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
function presentation(lang: Lang): Record<MortgageKey, Presentation> {
  const { mortgageLabels: l, installments } = COPY[lang];
  return {
    montoFinanciado: { label: l.montoFinanciado, prefix: 'S/' },
    cuota: { label: l.cuota, prefix: 'S/' },
    tea: { label: l.tea, suffix: '%' },
    tcea: { label: l.tcea, suffix: '%' },
    plazoCuotas: { label: l.plazoCuotas, suffix: installments },
    seguroDesgravamen: { label: l.seguroDesgravamen, suffix: '%' },
    seguroInmueble: { label: l.seguroInmueble, suffix: '%' },
    valorInmueble: { label: l.valorInmueble, prefix: 'S/' },
    totalAPagar: { label: l.totalAPagar, prefix: 'S/' },
  };
}

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

export function runDocumentPipeline(raw: string, lang: Lang = 'es'): DocumentResult {
  const copy = COPY[lang];
  const PRESENTATION = presentation(lang);
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
          ? copy.teaVariable
          : copy.teaFixed
        : alwaysAssumed
          ? copy.insuredValue
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
