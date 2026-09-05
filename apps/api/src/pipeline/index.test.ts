import { describe, expect, it } from 'vitest';
import { runPipeline } from './index.ts';

const base = {
  verdict: 'Regular como negocio.',
  fields: [
    { key: 'precio', label: 'Precio de compra', value: '250,000', prefix: 'S/', provenance: 'user', note: '' },
    { key: 'inicial', label: 'Cuota inicial', value: '10', suffix: '%', provenance: 'user', note: '' },
  ],
  metrics: [{ label: 'Alquiler', value: 'S/1,750', delta: null, context: 'al mes' }],
  scenarios: [],
  sources: [],
  prose: ['a', 'b', 'c', 'd', 'e'],
  followUps: ['1', '2', '3', '4'],
};

const turns = ['Depa de 250,000 en Pueblo Libre'];

describe('runPipeline', () => {
  it('accepts a valid envelope', () => {
    const r = runPipeline(JSON.stringify(base), turns);
    expect(r.ok).toBe(true);
  });

  it('caps prose at three items', () => {
    const r = runPipeline(JSON.stringify(base), turns);
    if (!r.ok) throw new Error('expected ok');
    expect(r.envelope.prose).toHaveLength(3);
  });

  it('caps followUps at three items', () => {
    const r = runPipeline(JSON.stringify(base), turns);
    if (!r.ok) throw new Error('expected ok');
    expect(r.envelope.followUps).toHaveLength(3);
  });

  it('downgrades a value the user never stated', () => {
    const r = runPipeline(JSON.stringify(base), turns);
    if (!r.ok) throw new Error('expected ok');
    const inicial = r.envelope.fields.find((f) => f.key === 'inicial');
    expect(inicial?.provenance).toBe('assumed');
  });

  it('repairs a badly formatted metric value', () => {
    const r = runPipeline(JSON.stringify(base), turns);
    if (!r.ok) throw new Error('expected ok');
    expect(r.envelope.metrics[0]!.value).toBe('S/ 1,750');
  });

  it('strips markdown fences before parsing', () => {
    const fenced = '```json\n' + JSON.stringify(base) + '\n```';
    expect(runPipeline(fenced, turns).ok).toBe(true);
  });

  it('falls back when the JSON is malformed', () => {
    const r = runPipeline('Con 30% de inicial la cuota baja a S/ 1,434.', turns);
    expect(r.ok).toBe(false);
  });

  it('returns the prose unchanged on fallback', () => {
    const text = 'Con 30% de inicial la cuota baja a S/ 1,434.';
    const r = runPipeline(text, turns);
    if (r.ok) throw new Error('expected fallback');
    expect(r.prose).toBe(text);
  });

  it('returns pin candidates on fallback', () => {
    const r = runPipeline('Con 30% de inicial la cuota baja.', turns);
    if (r.ok) throw new Error('expected fallback');
    expect(r.candidates).toContainEqual({ key: 'inicial', label: 'Cuota inicial', value: '30' });
  });

  it('falls back when JSON parses but fails the schema', () => {
    const r = runPipeline(JSON.stringify({ verdict: 'hola' }), turns);
    expect(r.ok).toBe(false);
  });

  it('leaves a percentage metric untouched', () => {
    const env = { ...base, metrics: [{ label: 'Yield neto', value: '6.2%', delta: null, context: 'bruto 8.4%' }] };
    const r = runPipeline(JSON.stringify(env), turns);
    if (!r.ok) throw new Error('expected ok');
    expect(r.envelope.metrics[0]!.value).toBe('6.2%');
  });

  it('leaves a point-delta untouched', () => {
    const env = { ...base, metrics: [{ label: 'Yield', value: '6.2%', delta: '↑ 1.0 pt', context: '' }] };
    const r = runPipeline(JSON.stringify(env), turns);
    if (!r.ok) throw new Error('expected ok');
    expect(r.envelope.metrics[0]!.delta).toBe('↑ 1.0 pt');
  });

  it('leaves a signed percentage delta untouched', () => {
    const env = { ...base, metrics: [{ label: 'Tasa', value: '8.0%', delta: '+0.25%', context: '' }] };
    const r = runPipeline(JSON.stringify(env), turns);
    if (!r.ok) throw new Error('expected ok');
    expect(r.envelope.metrics[0]!.delta).toBe('+0.25%');
  });

  it('leaves a decorated currency delta untouched', () => {
    const env = { ...base, metrics: [{ label: 'Ingreso', value: 'S/ 1,400', delta: '↓ S/ 443 bajo tu cuota', context: '' }] };
    const r = runPipeline(JSON.stringify(env), turns);
    if (!r.ok) throw new Error('expected ok');
    expect(r.envelope.metrics[0]!.delta).toBe('↓ S/ 443 bajo tu cuota');
  });

  it('still repairs a bare soles amount', () => {
    const env = { ...base, metrics: [{ label: 'Cuota', value: 'S/1434', delta: null, context: '' }] };
    const r = runPipeline(JSON.stringify(env), turns);
    if (!r.ok) throw new Error('expected ok');
    expect(r.envelope.metrics[0]!.value).toBe('S/ 1,434');
  });

  it('preserves a signed scenario value', () => {
    const env = {
      ...base,
      scenarios: [{ id: 'amoblado', cause: 'Si lo amueblas', value: '+S/ 250', unit: '/mes', tone: 'good', note: 'Rango 200-300.' }],
    };
    const r = runPipeline(JSON.stringify(env), turns);
    if (!r.ok) throw new Error('expected ok');
    expect(r.envelope.scenarios[0]!.value).toBe('+S/ 250');
  });

  it('groups thousands in a pinned field value', () => {
    const env = {
      ...base,
      fields: [{ key: 'precio', label: 'Precio de compra', value: '300000', prefix: 'S/', provenance: 'user', note: '' }],
    };
    const r = runPipeline(JSON.stringify(env), ['Depa de 300000 en Miraflores']);
    if (!r.ok) throw new Error('expected ok');
    expect(r.envelope.fields[0]!.value).toBe('300,000');
  });

  it('does not group a rate', () => {
    const env = {
      ...base,
      fields: [{ key: 'tasa', label: 'Tasa TEA', value: '7.5', suffix: '%', provenance: 'user', note: '' }],
    };
    const r = runPipeline(JSON.stringify(env), ['tasa 7.5%']);
    if (!r.ok) throw new Error('expected ok');
    expect(r.envelope.fields[0]!.value).toBe('7.5');
  });
});
