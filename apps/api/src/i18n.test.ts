import type { PinnedField } from '@chat/shared';
import { describe, expect, it } from 'vitest';
import { ENGLISH_ANSWER_RULE } from './i18n.ts';
import { runDocumentPipeline } from './pipeline/document.ts';
import { extractCandidates } from './pipeline/fallback.ts';
import { runPipeline } from './pipeline/index.ts';
import { enforceProvenance } from './pipeline/provenance.ts';
import { isOutOfScope } from './pipeline/scope.ts';
import { buildMessages } from './prompt.ts';
import { parseChatBody, runTurn } from './turn.ts';

const userField = (over: Partial<PinnedField>): PinnedField => ({
  key: 'precio', label: 'Purchase price', value: '250,000', provenance: 'user', note: '', ...over,
});

describe('English sessions', () => {
  it('reads Spanish when the client sends no language', () => {
    expect(parseChatBody({ messages: [{ role: 'user', content: 'hola' }] })?.lang).toBe('es');
    expect(parseChatBody({ messages: [{ role: 'user', content: 'hi' }], lang: 'en' })?.lang).toBe('en');
    expect(parseChatBody({ messages: [{ role: 'user', content: 'hi' }], lang: 'fr' })).toBeNull();
  });

  it('tells the model to answer in English, and only then', () => {
    const turns = [{ role: 'user' as const, content: 'hi' }];
    expect(buildMessages(turns, [], 'en').some((m) => m.content === ENGLISH_ANSWER_RULE)).toBe(true);
    expect(buildMessages(turns, []).some((m) => m.content === ENGLISH_ANSWER_RULE)).toBe(false);
  });

  it('writes its own progress step and refusal in English', async () => {
    const out = [];
    const body = { messages: [{ role: 'user' as const, content: 'Tell me a joke' }], fields: [], lang: 'en' as const };
    for await (const e of runTurn(body, async () => ({ content: '', truncated: false }))) out.push(e);
    const envelope = (out.find((e) => e.event === 'envelope')!.data as { envelope: { verdict: string } }).envelope;
    expect(envelope.verdict).toMatch(/only cover mortgages/);
  });

  it('keeps an English mortgage question in scope', () => {
    expect(isOutOfScope('Write python code for my mortgage payment')).toBe(false);
    expect(isOutOfScope('Write python code for a game')).toBe(true);
  });

  it('counts English values as said by the user', () => {
    const turn = ['An apartment priced at 250,000 soles, 30 years, 20% down, 8% interest rate'];
    expect(enforceProvenance([userField({})], turn)[0]!.provenance).toBe('user');
    expect(enforceProvenance([userField({ key: 'plazo', value: '30' })], turn)[0]!.provenance).toBe('user');
    expect(enforceProvenance([userField({ key: 'inicial', value: '20' })], turn)[0]!.provenance).toBe('user');
    expect(enforceProvenance([userField({ key: 'tasa', value: '8' })], turn)[0]!.provenance).toBe('user');
    expect(enforceProvenance([userField({ key: 'plazo', value: '30' })], ['not 30 years'])[0]!.provenance).toBe('assumed');
  });

  it('acknowledges a capture in English and recovers an English term', () => {
    const r = runPipeline(JSON.stringify({ kind: 'capture', reply: 'Got it.', fields: [] }), ['over 25 years'], '', 'en');
    expect(r).toMatchObject({
      ok: true,
      envelope: { verdict: 'Done, I got the property details.', fields: [{ key: 'plazo', label: 'Term', value: '25', suffix: 'years' }] },
    });
  });

  it('labels fallback chips and schedule rows in English', () => {
    expect(extractCandidates('With 20% down over 25 years', 'en')).toEqual([
      { key: 'inicial', label: 'Down payment', value: '20' },
      { key: 'plazo', label: 'Term', value: '25' },
    ]);
    const r = runDocumentPipeline(JSON.stringify({ tipo: 'cronograma', cuota: '3,051.10', plazoCuotas: '240', dudosos: [] }), 'en');
    expect(r).toMatchObject({ ok: true, fields: [
      { key: 'cuota', label: 'Monthly payment' },
      { key: 'plazoCuotas', label: 'Term', suffix: 'installments' },
    ] });
  });
});
