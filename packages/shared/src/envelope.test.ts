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

  it('rejects a scenario note that is empty', () => {
    const bad = { ...valid, scenarios: [{ ...valid.scenarios[0], note: '' }] };
    expect(AnalysisEnvelopeSchema.safeParse(bad).success).toBe(false);
  });
});
