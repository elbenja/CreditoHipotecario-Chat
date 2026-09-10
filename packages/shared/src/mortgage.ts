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
 * The down payment is what the buyer covers that the bank did not. Subtracts the
 * financed amount (banco-stated) from the price (user-stated). When they are equal,
 * returning zero would assert "you put nothing down" from figures that may not be
 * comparable: the price may be stale, approximate, or measure something different
 * than what the bank financed. Returning null leaves the field empty so the user
 * fills it, keeping the panel's rule of never presenting an inference as fact.
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
