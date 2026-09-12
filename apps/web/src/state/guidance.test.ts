import { describe, expect, it } from 'vitest';
import { chatReducer, initialState } from './chatReducer';
import { canExploreScenarios, getFieldQuestion, getAnalysisSuggestions, getMissingFields, toTurns } from './guidance';
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

  it('excludes empty assistant messages from the model history', () => {
    expect(toTurns([
      { id: '1', role: 'user', content: 'hola' },
      { id: '2', role: 'assistant-fallback', prose: '   ', candidates: [], truncated: true },
      { id: '3', role: 'assistant-question', field: 'precio', content: '' },
    ])).toEqual([{ role: 'user', content: 'hola' }]);
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

  it('removes price and initial badges as soon as those fields are fixed', () => {
    const initial: PinnedField = {
      key: 'inicial', label: 'Cuota inicial', value: '20', suffix: '%', provenance: 'assumed', note: '',
    };
    const missing = getMissingFields({ precio: price, inicial: initial });
    expect(missing).not.toContain('precio');
    expect(missing).not.toContain('inicial');
    expect(missing).not.toContain('alquiler');
  });

  it('offers scenario cards only after the mortgage inputs are defined', () => {
    const field = (key: PinnedField['key'], value: string): PinnedField => ({
      key, label: key, value, provenance: 'user', note: '',
    });
    expect(canExploreScenarios({ precio: price })).toBe(false);
    expect(canExploreScenarios({
      precio: price,
      inicial: field('inicial', '20'),
      tasa: field('tasa', '8'),
      plazo: field('plazo', '20'),
    })).toBe(true);
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

it('toTurns sends an assistant-note as an assistant turn', () => {
  const turns = toTurns([{ id: '1', role: 'assistant-note', content: 'Fijé ubicación del anuncio.' }]);
  expect(turns).toEqual([{ role: 'assistant', content: 'Fijé ubicación del anuncio.' }]);
});
