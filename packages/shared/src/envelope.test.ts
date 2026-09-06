import { describe, expect, it } from 'vitest';
import { AnalysisEnvelopeSchema } from './envelope.ts';

const valid = {
  verdict: 'Regular como negocio — depende de cuánta inicial pongas.',
  fields: [
    {
      key: 'tasa',
      label: 'Tasa TEA',
      value: '8.0',
      suffix: '%',
      provenance: 'user',
      note: 'Scotiabank desde 7.24% — es negociable.',
    },
  ],
  metrics: [
    { label: 'Alquiler realista', value: 'S/ 1,750', delta: null, context: 'al mes, sin amoblar' },
  ],
  scenarios: [
    {
      id: 'amoblado',
      cause: 'Si lo amueblas',
      value: '+S/ 250',
      unit: '/mes de alquiler',
      tone: 'good',
      note: 'Rango 200–300 según lo que pongas.',
    },
  ],
  sources: ['babilonia.pe'],
  prose: ['Un párrafo.'],
  followUps: ['¿Y con 30% de inicial?'],
};

describe('AnalysisEnvelopeSchema', () => {
  it('accepts a well-formed envelope', () => {
    expect(AnalysisEnvelopeSchema.parse(valid)).toMatchObject({ verdict: valid.verdict });
  });

  it('rejects an unknown field key', () => {
    const bad = { ...valid, fields: [{ ...valid.fields[0], key: 'jardin' }] };
    expect(AnalysisEnvelopeSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects an unknown scenario tone', () => {
    const bad = { ...valid, scenarios: [{ ...valid.scenarios[0], tone: 'amazing' }] };
    expect(AnalysisEnvelopeSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a missing verdict', () => {
    const { verdict, ...rest } = valid;
    expect(AnalysisEnvelopeSchema.safeParse(rest).success).toBe(false);
  });

  // Tolerating null means tolerating empty — both say "no note". Discarding an
  // entire valid analysis over one missing note is worse than shipping without
  // it. The rule that a note carries a range, caveat or cash cost is enforced
  // by the system prompt, which .min(1) never actually checked anyway.
  it('accepts a scenario note that is empty', () => {
    const ok = { ...valid, scenarios: [{ ...valid.scenarios[0], note: '' }] };
    expect(AnalysisEnvelopeSchema.safeParse(ok).success).toBe(true);
  });

  it('accepts a field whose note is null and normalises it to an empty string', () => {
    const withNull = {
      ...valid,
      fields: [{ ...valid.fields[0], note: null }],
    };
    const parsed = AnalysisEnvelopeSchema.parse(withNull);
    expect(parsed.fields[0]!.note).toBe('');
  });

  it('accepts a field with no note property at all', () => {
    const { note, ...rest } = valid.fields[0]!;
    const without = { ...valid, fields: [rest] };
    expect(AnalysisEnvelopeSchema.safeParse(without).success).toBe(true);
  });

  it('preserves a note that is a real string', () => {
    const parsed = AnalysisEnvelopeSchema.parse(valid);
    expect(parsed.fields[0]!.note).toBe(valid.fields[0]!.note);
  });

  it('accepts a scenario whose note is null and normalises it', () => {
    const withNull = { ...valid, scenarios: [{ ...valid.scenarios[0], note: null }] };
    expect(AnalysisEnvelopeSchema.parse(withNull).scenarios[0]!.note).toBe('');
  });

  it('rejects a scenario with an empty id', () => {
    const bad = { ...valid, scenarios: [{ ...valid.scenarios[0], id: '   ' }] };
    expect(AnalysisEnvelopeSchema.safeParse(bad).success).toBe(false);
  });

  it('accepts a field whose prefix and suffix are null', () => {
    const withNulls = { ...valid, fields: [{ ...valid.fields[0], prefix: null, suffix: null }] };
    const parsed = AnalysisEnvelopeSchema.parse(withNulls);
    expect(parsed.fields[0]!.prefix).toBeUndefined();
    expect(parsed.fields[0]!.suffix).toBeUndefined();
  });

  it('preserves a real prefix and suffix', () => {
    const withValues = { ...valid, fields: [{ ...valid.fields[0], prefix: 'S/', suffix: '%' }] };
    const parsed = AnalysisEnvelopeSchema.parse(withValues);
    expect(parsed.fields[0]!.prefix).toBe('S/');
    expect(parsed.fields[0]!.suffix).toBe('%');
  });

  it('accepts a metric whose delta key is absent', () => {
    const noDelta = { ...valid, metrics: [{ label: 'Alquiler', value: 'S/ 1,750', context: 'al mes' }] };
    const parsed = AnalysisEnvelopeSchema.parse(noDelta);
    expect(parsed.metrics[0]!.delta).toBeNull();
  });

  it('preserves a real metric delta', () => {
    const withDelta = { ...valid, metrics: [{ label: 'Yield', value: '6.2%', delta: '↑ 1.0 pt', context: '' }] };
    const parsed = AnalysisEnvelopeSchema.parse(withDelta);
    expect(parsed.metrics[0]!.delta).toBe('↑ 1.0 pt');
  });
});
