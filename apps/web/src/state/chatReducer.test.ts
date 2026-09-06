import type { AnalysisEnvelope } from '@chat/shared';
import { describe, expect, it } from 'vitest';
import { chatReducer, initialState, selectDirtyKeys } from './chatReducer';

const envelope: AnalysisEnvelope = {
  verdict: 'Regular como negocio.',
  fields: [
    { key: 'tasa', label: 'Tasa TEA', value: '8.0', suffix: '%', provenance: 'user', note: 'n' },
    { key: 'inicial', label: 'Cuota inicial', value: '10', suffix: '%', provenance: 'assumed', note: 'n' },
  ],
  metrics: [],
  scenarios: [],
  sources: [],
  prose: ['uno'],
  followUps: ['a', 'b', 'c'],
};

describe('chatReducer', () => {
  it('appends a user message on send', () => {
    const s = chatReducer(initialState, { type: 'send', content: 'hola' });
    expect(s.messages).toHaveLength(1);
    expect(s.status).toBe('thinking');
  });

  it('records analyze steps in order', () => {
    let s = chatReducer(initialState, { type: 'analyzeStep', label: 'uno' });
    s = chatReducer(s, { type: 'analyzeStep', label: 'dos' });
    expect(s.analyzeSteps.map((x) => x.label)).toEqual(['uno', 'dos']);
  });

  it('appends an assistant message on envelope', () => {
    const s = chatReducer(initialState, { type: 'envelope', envelope });
    expect(s.messages.at(-1)!.role).toBe('assistant');
    expect(s.status).toBe('idle');
  });

  it('pins fields from the envelope', () => {
    const s = chatReducer(initialState, { type: 'envelope', envelope });
    expect(s.fields.tasa!.value).toBe('8.0');
  });

  it('sets the baseline to the pinned values', () => {
    const s = chatReducer(initialState, { type: 'envelope', envelope });
    expect(s.baseline.tasa).toBe('8.0');
  });

  it('reports no dirty keys immediately after an envelope', () => {
    const s = chatReducer(initialState, { type: 'envelope', envelope });
    expect(selectDirtyKeys(s)).toEqual([]);
  });

  it('reports a dirty key after an edit', () => {
    let s = chatReducer(initialState, { type: 'envelope', envelope });
    s = chatReducer(s, { type: 'editField', key: 'tasa', value: '7.24' });
    expect(selectDirtyKeys(s)).toEqual(['tasa']);
  });

  it('clears dirty state when a new envelope arrives', () => {
    let s = chatReducer(initialState, { type: 'envelope', envelope });
    s = chatReducer(s, { type: 'editField', key: 'tasa', value: '7.24' });
    s = chatReducer(s, { type: 'envelope', envelope });
    expect(selectDirtyKeys(s)).toEqual([]);
  });

  it('never mutates a rendered message when a new envelope arrives', () => {
    let s = chatReducer(initialState, { type: 'envelope', envelope });
    const first = s.messages[0];
    s = chatReducer(s, { type: 'envelope', envelope });
    expect(s.messages).toHaveLength(2);
    expect(s.messages[0]).toBe(first);
  });

  it('appends a fallback message', () => {
    const s = chatReducer(initialState, { type: 'fallback', prose: 'texto', candidates: [] });
    expect(s.messages.at(-1)!.role).toBe('assistant-fallback');
  });

  it('records an error without dropping messages', () => {
    let s = chatReducer(initialState, { type: 'send', content: 'hola' });
    s = chatReducer(s, { type: 'error', message: 'se cayó' });
    expect(s.status).toBe('error');
    expect(s.error).toBe('se cayó');
    expect(s.messages).toHaveLength(1);
  });
});

describe('value-change arbitration', () => {
  const revised = (value: string): AnalysisEnvelope => ({
    ...envelope,
    fields: [
      { key: 'tasa', label: 'Tasa TEA', value, suffix: '%', provenance: 'assumed', note: 'n' },
    ],
  });

  // Tier 1 — filling an empty field is the core loop, and must stay silent.
  it('records no change when a field is filled for the first time', () => {
    const s = chatReducer(initialState, { type: 'envelope', envelope });
    expect(s.changes).toEqual([]);
  });

  // Tier 2 — the model revising its own assumption must be announced.
  it('records a change when the model revises a value', () => {
    let s = chatReducer(initialState, { type: 'envelope', envelope });
    s = chatReducer(s, { type: 'envelope', envelope: revised('7.5') });
    expect(s.changes).toEqual([
      { key: 'tasa', label: 'Tasa TEA', from: '8.0', to: '7.5' },
    ]);
    expect(s.fields.tasa!.value).toBe('7.5');
  });

  it('reverts a change back to the previous value', () => {
    let s = chatReducer(initialState, { type: 'envelope', envelope });
    s = chatReducer(s, { type: 'envelope', envelope: revised('7.5') });
    s = chatReducer(s, { type: 'revertChange', key: 'tasa' });
    expect(s.fields.tasa!.value).toBe('8.0');
    expect(s.changes).toEqual([]);
  });

  it('clears announced changes on dismiss', () => {
    let s = chatReducer(initialState, { type: 'envelope', envelope });
    s = chatReducer(s, { type: 'envelope', envelope: revised('7.5') });
    s = chatReducer(s, { type: 'dismissChanges' });
    expect(s.changes).toEqual([]);
    expect(s.fields.tasa!.value).toBe('7.5');
  });

  it('marks a field as user-edited when typed into', () => {
    let s = chatReducer(initialState, { type: 'envelope', envelope });
    s = chatReducer(s, { type: 'editField', key: 'tasa', value: '7.24' });
    expect(s.userEdited).toContain('tasa');
  });

  // Tier 4 — the case that matters.
  it('blocks the model from overwriting a user-typed value', () => {
    let s = chatReducer(initialState, { type: 'envelope', envelope });
    s = chatReducer(s, { type: 'editField', key: 'tasa', value: '7.24' });
    s = chatReducer(s, { type: 'envelope', envelope: revised('9.9') });
    expect(s.fields.tasa!.value).toBe('7.24');
    expect(s.proposals.tasa!.value).toBe('9.9');
    expect(s.changes).toEqual([]);
  });

  it('applies a proposal when accepted', () => {
    let s = chatReducer(initialState, { type: 'envelope', envelope });
    s = chatReducer(s, { type: 'editField', key: 'tasa', value: '7.24' });
    s = chatReducer(s, { type: 'envelope', envelope: revised('9.9') });
    s = chatReducer(s, { type: 'acceptProposal', key: 'tasa' });
    expect(s.fields.tasa!.value).toBe('9.9');
    expect(s.proposals.tasa).toBeUndefined();
  });

  it('keeps the field locked after a proposal is accepted', () => {
    let s = chatReducer(initialState, { type: 'envelope', envelope });
    s = chatReducer(s, { type: 'editField', key: 'tasa', value: '7.24' });
    s = chatReducer(s, { type: 'envelope', envelope: revised('9.9') });
    s = chatReducer(s, { type: 'acceptProposal', key: 'tasa' });
    expect(s.userEdited).toContain('tasa');
  });

  it('drops a proposal when rejected, keeping the user value', () => {
    let s = chatReducer(initialState, { type: 'envelope', envelope });
    s = chatReducer(s, { type: 'editField', key: 'tasa', value: '7.24' });
    s = chatReducer(s, { type: 'envelope', envelope: revised('9.9') });
    s = chatReducer(s, { type: 'rejectProposal', key: 'tasa' });
    expect(s.fields.tasa!.value).toBe('7.24');
    expect(s.proposals.tasa).toBeUndefined();
  });

  it('does not raise a proposal when the model agrees with the user', () => {
    let s = chatReducer(initialState, { type: 'envelope', envelope });
    s = chatReducer(s, { type: 'editField', key: 'tasa', value: '7.24' });
    s = chatReducer(s, { type: 'envelope', envelope: revised('7.24') });
    expect(s.proposals).toEqual({});
  });

  it('leaves a blocked field undirty, since the shown value is in effect', () => {
    let s = chatReducer(initialState, { type: 'envelope', envelope });
    s = chatReducer(s, { type: 'editField', key: 'tasa', value: '7.24' });
    s = chatReducer(s, { type: 'envelope', envelope: revised('9.9') });
    expect(selectDirtyKeys(s)).toEqual([]);
  });
});

describe('user-typed provenance', () => {
  const assumedTasa: AnalysisEnvelope = {
    ...envelope,
    fields: [{ key: 'tasa', label: 'Tasa TEA', value: '8.0', suffix: '%', provenance: 'assumed', note: 'n' }],
  };

  it('marks a field the user typed as user-stated', () => {
    let s = chatReducer(initialState, { type: 'envelope', envelope: assumedTasa });
    expect(s.fields.tasa!.provenance).toBe('assumed');
    s = chatReducer(s, { type: 'editField', key: 'tasa', value: '7.24' });
    expect(s.fields.tasa!.provenance).toBe('user');
  });

  it('does not let the model downgrade a value the user typed', () => {
    let s = chatReducer(initialState, { type: 'envelope', envelope: assumedTasa });
    s = chatReducer(s, { type: 'editField', key: 'tasa', value: '7.24' });
    // The model echoes the same value back, still calling it assumed.
    const echoed: AnalysisEnvelope = {
      ...envelope,
      fields: [{ key: 'tasa', label: 'Tasa TEA', value: '7.24', suffix: '%', provenance: 'assumed', note: 'n' }],
    };
    s = chatReducer(s, { type: 'envelope', envelope: echoed });
    expect(s.fields.tasa!.provenance).toBe('user');
  });

  it('still adopts the model provenance for a field the user never touched', () => {
    const s = chatReducer(initialState, { type: 'envelope', envelope: assumedTasa });
    expect(s.fields.tasa!.provenance).toBe('assumed');
  });
});

describe('pinCandidate', () => {
  it('pins a candidate as user-stated', () => {
    const s = chatReducer(initialState, {
      type: 'pinCandidate', key: 'inicial', label: 'Cuota inicial', value: '30',
    });
    expect(s.fields.inicial!.value).toBe('30');
    expect(s.fields.inicial!.provenance).toBe('user');
  });

  it('locks the pinned field against model overwrite', () => {
    const s = chatReducer(initialState, {
      type: 'pinCandidate', key: 'inicial', label: 'Cuota inicial', value: '30',
    });
    expect(s.userEdited).toContain('inicial');
  });

  it('leaves the panel undirty after pinning', () => {
    const s = chatReducer(initialState, {
      type: 'pinCandidate', key: 'inicial', label: 'Cuota inicial', value: '30',
    });
    expect(selectDirtyKeys(s)).toEqual([]);
  });
});
