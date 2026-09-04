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
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  provenance: ProvenanceSchema,
  note: z.string(),
});

export const ScenarioSchema = z.object({
  id: z.string().min(1),
  cause: z.string().min(1),
  value: z.string().min(1),
  unit: z.string(),
  tone: z.enum(['good', 'tradeoff', 'bad']),
  // The design rule: a note must always carry a range, caveat or cash cost.
  note: z.string().min(1),
});

export const MetricSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  delta: z.string().nullable(),
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
