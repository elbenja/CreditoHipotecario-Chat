import { describe, expect, it } from 'vitest';
import { chatReducer, initialState } from './chatReducer';
import { getFieldQuestion, getAnalysisSuggestions, toTurns } from './guidance';
import type { PinnedField } from '@chat/shared';

const price: PinnedField = { key: 'precio', label: 'Precio', value: '300,000', provenance: 'user', note: '' };

describe('guided capture', () => {
  it('asks locally and stays idle; a short answer keeps its field context', () => {
    const asked = chatReducer(initialState, { type: 'askField', key: 'tasa' });
    expect(asked.status).toBe('idle');
    expect(asked.messages.at(-1)).toMatchObject({ role: 'assistant-question', content: getFieldQuestion('tasa') });
    const sent = chatReducer(asked, { type: 'send', content: '8%' });
    expect(sent.pendingField).toBeNull();
    expect(toTurns(sent.messages)).toEqual([
      { role: 'assistant', content: getFieldQuestion('tasa') },
      { role: 'user', content: 'Tasa: 8%' },
    ]);
  });

  it('uses the existing value when asking for a correction', () => {
    expect(getFieldQuestion('precio', price)).toContain('300,000');
    expect(getFieldQuestion('precio', price)).toContain('nuevo');
  });

  it('does not offer analysis before there are useful property data', () => {
    expect(getAnalysisSuggestions({})).toEqual([]);
    expect(getAnalysisSuggestions({ precio: price })).toEqual(['¿Cuánto pagaría al mes?']);
    expect(getAnalysisSuggestions({ precio: price, ubicacion: { ...price, key: 'ubicacion', value: 'Pueblo Libre' } }))
      .toContain('¿Cómo sería este depa como inversión?');
  });
});

it('keeps old analysis dirty after a conversational price correction', () => {
  const analysis = { kind: 'analysis' as const, verdict: 'Cuota', fields: [price], metrics: [{ label: 'Cuota', value: 'S/ 2,000', delta: null, context: '' }], scenarios: [], sources: [], prose: [], followUps: [] };
  const before = chatReducer(initialState, { type: 'envelope', envelope: analysis });
  const after = chatReducer(before, { type: 'envelope', envelope: { ...analysis, kind: 'capture', verdict: 'Precio actualizado.', fields: [{ ...price, value: '350,000' }], metrics: [] } });
  expect(after.fields.precio?.value).toBe('350,000');
  expect(after.baseline.precio).toBe('300,000');
});

it('remembers which fact a model-generated clarification requested', () => {
  const asking = chatReducer(initialState, { type: 'envelope', envelope: {
    kind: 'capture', askField: 'area', verdict: '¿Cuántos metros cuadrados tiene?', fields: [], metrics: [], scenarios: [], sources: [], prose: [], followUps: [],
  } });
  const answer = chatReducer(asking, { type: 'send', content: '80' });
  expect(toTurns(answer.messages).at(-1)?.content).toBe('Área: 80');
});
