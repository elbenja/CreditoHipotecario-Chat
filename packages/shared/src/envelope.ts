import { z } from 'zod';

export const FIELD_KEYS = [
  'ubicacion',
  'precio',
  'area',
  'tasa',
  'inicial',
  'plazo',
  'alquiler',
] as const;

export const ProvenanceSchema = z.enum(['user', 'assumed', 'market']);

export const PinnedFieldSchema = z.object({
  key: z.enum(FIELD_KEYS),
  label: z.string().min(1),
  value: z.string().min(1),
  // kimi-k2.6 sends either an absent key or an explicit null for "no value",
  // varying between calls. .optional() rejects null and .nullable() rejects
  // omission, so accept both and normalise.
  prefix: z.string().nullish().transform((v) => v ?? undefined),
  suffix: z.string().nullish().transform((v) => v ?? undefined),
  provenance: ProvenanceSchema,
  // kimi-k2.6 emits `null` for a field with no note. Accept null/absent and
  // normalise to '' — the pipeline is the trust boundary and should tolerate
  // this rather than discard an otherwise-valid analysis.
  note: z.string().nullish().transform((v) => v ?? ''),
});

export const ScenarioSchema = z.object({
  id: z.string().trim().min(1),
  cause: z.string().min(1),
  value: z.string().min(1),
  unit: z.string(),
  tone: z.enum(['good', 'tradeoff', 'bad']),
  // A note must carry a range, caveat or cash cost — but tolerate the model's
  // null the way PinnedField does, rather than discarding a whole analysis.
  note: z.string().nullish().transform((v) => v ?? ''),
});

export const MetricSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  delta: z.string().nullish().transform((v) => v ?? null),
  context: z.string(),
});

export const AnalysisEnvelopeSchema = z.object({
  verdict: z.string().min(1),
  fields: z.array(PinnedFieldSchema),
  metrics: z.array(MetricSchema),
  scenarios: z.array(ScenarioSchema),
  sources: z.array(z.string()),
  prose: z.array(z.string()),
  followUps: z.array(z.string()),
});

export type Provenance = z.infer<typeof ProvenanceSchema>;
export type FieldKey = (typeof FIELD_KEYS)[number];
export type PinnedField = z.infer<typeof PinnedFieldSchema>;
export type Scenario = z.infer<typeof ScenarioSchema>;
export type Metric = z.infer<typeof MetricSchema>;
export type AnalysisEnvelope = z.infer<typeof AnalysisEnvelopeSchema>;
