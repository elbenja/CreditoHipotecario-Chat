import { describe, expect, it } from 'vitest';
import { applyCalcs } from './calc.ts';
import { runPipeline } from './index.ts';
import { runTurn } from '../turn.ts';

const base = { id: 'actual', precio: 250000, inicial: 50000, tea: 8, plazoAnios: 20 };
const more = { id: 'mas', precio: 250000, inicial: 75000, tea: 8, plazoAnios: 20 };

const fillOne = (text: string, calculos: unknown[] = [base, more]) => {
  const out = applyCalcs({ calculos, verdict: text });
  return out.ok ? (out.value as { verdict: string }).verdict : null;
};

describe('applyCalcs', () => {
  it('fills the payment from the tested function, not the model', () => {
    // Independently checked: 200,000 at 8% TEA over 240 months is 1,638.30.
    expect(fillOne('Pagas {{actual.cuota}} al mes.')).toBe('Pagas S/ 1,638 al mes.');
  });

  it('fills every figure of a calculation', () => {
    expect(fillOne('{{actual.monto}} · {{actual.inicial}} · {{actual.intereses}} · {{actual.total}} · {{actual.tasaMensual}}'))
      .toBe('S/ 200,000 · S/ 50,000 · S/ 193,192 · S/ 393,192 · 0.643%');
  });

  it('compares an alternative against the first calculation', () => {
    // 1,434 against 1,638: the delta is the difference of the rounded cards.
    expect(fillOne('{{mas.cuota}} · {{mas.difCuota}} · {{mas.deltaCuota}} · {{mas.cambioCuota}} · {{mas.difInicial}} · {{mas.difIntereses}}'))
      .toBe('S/ 1,434 · S/ 204 · ↓ S/ 204 · -S/ 204 · S/ 25,000 · S/ 24,149');
  });

  it('signs a rise the other way', () => {
    expect(fillOne('{{actual.deltaCuota}} {{actual.cambioCuota}}', [more, { ...base, id: 'actual' }])).toBe('↑ S/ 204 +S/ 204');
  });

  it('takes a percentage down payment, months, and written numbers', () => {
    expect(fillOne('{{a.cuota}}', [{ id: 'a', precio: '250,000', inicialPct: 20, tea: '8', plazoMeses: 240 }]))
      .toBe('S/ 1,638');
  });

  it('fills markers anywhere in the reply and drops "calculos"', () => {
    const out = applyCalcs({
      calculos: [base],
      metrics: [{ label: 'Cuota', value: '{{ actual.cuota }}', context: 'sobre {{actual.monto}}' }],
    });
    expect(out).toEqual({
      ok: true,
      value: { metrics: [{ label: 'Cuota', value: 'S/ 1,638', context: 'sobre S/ 200,000' }] },
      unverified: [],
    });
  });

  it('drops a currency sign the model wrote in front of a marker', () => {
    expect(fillOne('S/ {{actual.cuota}} y S/{{mas.cambioCuota}}')).toBe('S/ 1,638 y -S/ 204');
  });

  it('echoes the inputs of a calculation', () => {
    expect(fillOne('{{actual.precio}} al {{actual.tea}} en {{actual.plazoAnios}} años ({{actual.plazoMeses}} cuotas)'))
      .toBe('S/ 250,000 al 8% en 20 años (240 cuotas)');
  });

  it('refuses to compare the base with itself', () => {
    expect(fillOne('baja {{actual.difCuota}}')).toBeNull();
    expect(fillOne('{{actual.deltaCuota}}')).toBeNull();
  });

  it('leaves a reply with no markers and no calculations alone', () => {
    expect(applyCalcs({ verdict: 'Hola', fields: [] })).toEqual({ ok: true, value: { verdict: 'Hola', fields: [] }, unverified: [] });
  });

  it('fails rather than show a marker it cannot fill', () => {
    expect(fillOne('{{otro.cuota}}')).toBeNull();
    expect(fillOne('{{actual.rendimiento}}')).toBeNull();
    expect(fillOne('{{actual.cuota}}', [])).toBeNull();
  });

  it('fails on a calculation with missing or impossible inputs', () => {
    expect(fillOne('x', [{ id: 'a', precio: 250000, inicial: 50000, tea: 8 }])).toBeNull();
    expect(fillOne('x', [{ id: 'a', precio: 250000, inicial: 300000, tea: 8, plazoAnios: 20 }])).toBeNull();
  });
});

describe('amounts the model typed itself', () => {
  const unverified = (reply: object, userTurns: string[] = []) => {
    const out = applyCalcs({ calculos: [base, more], ...reply }, userTurns);
    return out.ok ? out.unverified : null;
  };

  it('flags a hand-written figure that nothing computed backs', () => {
    // Seen live, beside a computed delta of S/ 204.
    expect(unverified({ verdict: 'Your payment drops by S/ 410.' })).toEqual(['S/ 410']);
    expect(unverified({ metrics: [{ value: 'S/ 1,673', delta: null }] })).toEqual(['S/ 1,673']);
  });

  it('accepts figures that match the calculations, the fields or the user', () => {
    expect(unverified({ verdict: 'Financias S/ 200,000 y pagas S/ 1,638; con más inicial baja S/ 204.' })).toEqual([]);
    expect(unverified({ verdict: 'Con S/ 1,800 de alquiler.', fields: [{ key: 'alquiler', value: '1,800' }] })).toEqual([]);
    expect(unverified({ verdict: 'Con tu sueldo de S/ 9,000.' }, ['gano 9000 al mes'])).toEqual([]);
  });

  it('does not judge a reply that declared no calculation', () => {
    expect(applyCalcs({ verdict: 'Un alquiler de S/ 1,750.' })).toMatchObject({ unverified: [] });
  });
});

describe('runPipeline with calculations', () => {
  const reply = (extra: object) => JSON.stringify({
    kind: 'analysis', verdict: 'Pagarías {{actual.cuota}} al mes.', fields: [],
    metrics: [{ label: 'Cuota mensual', value: '{{actual.cuota}}', delta: null, context: 'tasa fija, sin seguros' }],
    scenarios: [], sources: [], prose: [], followUps: [], ...extra,
  });

  it('delivers the computed figures in the envelope', () => {
    const result = runPipeline(reply({ calculos: [base] }), ['¿cuánto pagaría al mes?']);
    expect(result.ok && result.envelope.verdict).toBe('Pagarías S/ 1,638 al mes.');
    expect(result.ok && result.envelope.metrics[0]?.value).toBe('S/ 1,638');
  });

  it('pins a rate and term the user wrote even when the model left them out of fields', () => {
    const result = runPipeline(reply({ calculos: [base] }), ['8% TEA over 20 years'], '', 'en');
    expect(result.ok && result.envelope.fields.map((f) => [f.key, f.value, f.provenance])).toEqual([
      ['tasa', '8', 'user'],
      ['plazo', '20', 'user'],
    ]);
  });

  it('falls back with a written message when the figures cannot be computed', () => {
    const result = runPipeline(reply({ calculos: [] }), ['¿cuánto pagaría al mes?'], '', 'en');
    expect(result).toEqual({ ok: false, retryable: true, prose: "I couldn't run the numbers this time. Ask again and I'll retry.", candidates: [] });
  });
});

describe('runTurn with calculations', () => {
  const answer = (verdict: string) => JSON.stringify({
    kind: 'analysis', calculos: [base], verdict, fields: [], metrics: [], scenarios: [], sources: [], prose: [], followUps: [],
  });
  const run = async (replies: string[]) => {
    let calls = 0;
    const events = [];
    const turn = runTurn(
      { messages: [{ role: 'user', content: '¿cuánto pagaría al mes?' }], fields: [] },
      async () => ({ content: replies[calls++]!, truncated: false }),
    );
    for await (const e of turn) events.push(e);
    return { calls, last: events.at(-1)! };
  };

  it('asks the model once more when a marker cannot be filled', async () => {
    const { calls, last } = await run([answer('{{actual.rendimiento}}'), answer('Pagarías {{actual.cuota}}.')]);
    expect(calls).toBe(2);
    expect(last.event).toBe('envelope');
    expect((last.data as { envelope: { verdict: string } }).envelope.verdict).toBe('Pagarías S/ 1,638.');
  });

  it('asks once more when the model typed a figure by hand, and says which', async () => {
    const prompts: unknown[][] = [];
    const replies = [answer('Baja S/ 410.'), answer('Pagarías {{actual.cuota}}.')];
    const events = [];
    for await (const e of runTurn(
      { messages: [{ role: 'user', content: '¿y con más inicial?' }], fields: [] },
      async (messages) => { prompts.push(messages); return { content: replies[prompts.length - 1]!, truncated: false }; },
    )) events.push(e);
    expect(prompts).toHaveLength(2);
    expect(JSON.stringify(prompts[1]!.at(-1))).toContain('S/ 410');
    expect((events.at(-1)!.data as { envelope: { verdict: string } }).envelope.verdict).toBe('Pagarías S/ 1,638.');
  });

  it('keeps the first answer when the second one breaks the contract', async () => {
    const { calls, last } = await run([answer('Baja S/ 410.'), 'not json']);
    expect(calls).toBe(2);
    expect((last.data as { envelope: { verdict: string } }).envelope.verdict).toBe('Baja S/ 410.');
  });

  it('gives up after one retry', async () => {
    const { calls, last } = await run([answer('{{actual.rendimiento}}'), answer('{{actual.rendimiento}}')]);
    expect(calls).toBe(2);
    expect(last.event).toBe('fallback');
  });
});
