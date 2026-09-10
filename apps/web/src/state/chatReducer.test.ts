import type { AnalysisEnvelope, Scenario } from '@chat/shared';
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
    s = chatReducer(s, { type: 'error', kind: 'api', message: 'se cayó', retry: 'hola' });
    expect(s.status).toBe('error');
    expect(s.error?.message).toBe('se cayó');
    expect(s.messages).toHaveLength(1);
  });

  it('gives every message a unique id, even across a simulated reload', () => {
    let s = chatReducer(initialState, { type: 'send', content: 'uno' });
    s = chatReducer(s, { type: 'send', content: 'dos' });
    // A reload restores the messages but re-initialises module state.
    const restored = { ...initialState, messages: s.messages };
    const after = chatReducer(restored, { type: 'send', content: 'tres' });
    const ids = after.messages.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
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

describe('saved scenarios', () => {
  const scen = (id: string, value = '+S/ 250'): Scenario => ({
    id,
    cause: 'Si lo amueblas',
    value,
    unit: '/mes de alquiler',
    tone: 'good',
    note: 'Rango 200-300.',
  });

  it('saves a scenario', () => {
    const s = chatReducer(initialState, { type: 'saveScenario', scenario: scen('amoblado') });
    expect(s.savedScenarios).toHaveLength(1);
    expect(s.savedScenarios[0]!.id).toBe('amoblado');
  });

  it('does not save the same id twice', () => {
    let s = chatReducer(initialState, { type: 'saveScenario', scenario: scen('amoblado') });
    s = chatReducer(s, { type: 'saveScenario', scenario: scen('amoblado') });
    expect(s.savedScenarios).toHaveLength(1);
  });

  it('keeps the first value when the same id is saved again', () => {
    let s = chatReducer(initialState, { type: 'saveScenario', scenario: scen('amoblado', '+S/ 250') });
    s = chatReducer(s, { type: 'saveScenario', scenario: scen('amoblado', '+S/ 900') });
    expect(s.savedScenarios[0]!.value).toBe('+S/ 250');
  });

  it('preserves save order', () => {
    let s = chatReducer(initialState, { type: 'saveScenario', scenario: scen('a') });
    s = chatReducer(s, { type: 'saveScenario', scenario: scen('b') });
    expect(s.savedScenarios.map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('deletes a scenario', () => {
    let s = chatReducer(initialState, { type: 'saveScenario', scenario: scen('a') });
    s = chatReducer(s, { type: 'deleteScenario', id: 'a' });
    expect(s.savedScenarios).toEqual([]);
  });

  it('remembers the deleted scenario so it can be undone', () => {
    let s = chatReducer(initialState, { type: 'saveScenario', scenario: scen('a') });
    s = chatReducer(s, { type: 'deleteScenario', id: 'a' });
    expect(s.lastDeleted?.id).toBe('a');
  });

  it('restores a deleted scenario on undo', () => {
    let s = chatReducer(initialState, { type: 'saveScenario', scenario: scen('a') });
    s = chatReducer(s, { type: 'deleteScenario', id: 'a' });
    s = chatReducer(s, { type: 'undoDelete' });
    expect(s.savedScenarios.map((x) => x.id)).toEqual(['a']);
    expect(s.lastDeleted).toBeNull();
  });

  it('undo is a no-op when nothing was deleted', () => {
    const s = chatReducer(initialState, { type: 'undoDelete' });
    expect(s.savedScenarios).toEqual([]);
  });

  it('deleting an unknown id changes nothing', () => {
    const s = chatReducer(initialState, { type: 'deleteScenario', id: 'nope' });
    expect(s.savedScenarios).toEqual([]);
    expect(s.lastDeleted).toBeNull();
  });
});

describe('recalculate', () => {
  const envelopeWithTasa: AnalysisEnvelope = {
    ...envelope,
    fields: [
      { key: 'tasa', label: 'Tasa TEA', value: '8.0', suffix: '%', provenance: 'user', note: 'n' },
    ],
  };

  it('clears the dirty set', () => {
    let s = chatReducer(initialState, { type: 'envelope', envelope: envelopeWithTasa });
    s = chatReducer(s, { type: 'editField', key: 'tasa', value: '7.24' });
    expect(selectDirtyKeys(s)).toEqual(['tasa']);
    s = chatReducer(s, { type: 'recalculate' });
    expect(selectDirtyKeys(s)).toEqual([]);
  });

  it('keeps the edited value as the new baseline', () => {
    let s = chatReducer(initialState, { type: 'envelope', envelope: envelopeWithTasa });
    s = chatReducer(s, { type: 'editField', key: 'tasa', value: '7.24' });
    s = chatReducer(s, { type: 'recalculate' });
    expect(s.fields.tasa!.value).toBe('7.24');
    expect(s.baseline.tasa).toBe('7.24');
  });

  it('enters the thinking state', () => {
    const s = chatReducer(initialState, { type: 'recalculate' });
    expect(s.status).toBe('thinking');
  });

  it('does not append or mutate any message', () => {
    let s = chatReducer(initialState, { type: 'envelope', envelope: envelopeWithTasa });
    const before = s.messages;
    s = chatReducer(s, { type: 'recalculate' });
    expect(s.messages).toBe(before);
  });

  it('keeps a field locked after recalculating', () => {
    let s = chatReducer(initialState, { type: 'envelope', envelope: envelopeWithTasa });
    s = chatReducer(s, { type: 'editField', key: 'tasa', value: '7.24' });
    s = chatReducer(s, { type: 'recalculate' });
    expect(s.userEdited).toContain('tasa');
  });
});

describe('error kinds', () => {
  it('records an api error with the question to retry', () => {
    let s = chatReducer(initialState, { type: 'send', content: '¿Es buen negocio?' });
    s = chatReducer(s, { type: 'error', kind: 'api', message: 'Se cayó.', retry: '¿Es buen negocio?' });
    expect(s.status).toBe('error');
    expect(s.error?.kind).toBe('api');
    expect(s.error?.retry).toBe('¿Es buen negocio?');
  });

  it('keeps the failed question in the transcript', () => {
    let s = chatReducer(initialState, { type: 'send', content: '¿Es buen negocio?' });
    s = chatReducer(s, { type: 'error', kind: 'api', message: 'x', retry: '¿Es buen negocio?' });
    expect(s.messages).toHaveLength(1);
    expect(s.messages[0]!.role).toBe('user');
  });

  it('never discards pinned fields on an error', () => {
    let s = chatReducer(initialState, { type: 'envelope', envelope, truncated: false });
    const fieldCount = Object.keys(s.fields).length;
    s = chatReducer(s, { type: 'error', kind: 'api', message: 'x', retry: null });
    expect(Object.keys(s.fields)).toHaveLength(fieldCount);
  });

  it('clears the error and returns to idle', () => {
    let s = chatReducer(initialState, { type: 'error', kind: 'api', message: 'x', retry: 'q' });
    s = chatReducer(s, { type: 'clearError' });
    expect(s.error).toBeNull();
    expect(s.status).toBe('idle');
  });
});

describe('offline queue', () => {
  it('marks the app offline', () => {
    const s = chatReducer(initialState, { type: 'setOffline', offline: true });
    expect(s.offline).toBe(true);
  });

  it('queues a message instead of sending it', () => {
    let s = chatReducer(initialState, { type: 'setOffline', offline: true });
    s = chatReducer(s, { type: 'queue', content: '¿Y con 30%?' });
    expect(s.queued).toBe('¿Y con 30%?');
  });

  it('clears the queue on dequeue', () => {
    let s = chatReducer(initialState, { type: 'queue', content: '¿Y con 30%?' });
    s = chatReducer(s, { type: 'dequeue' });
    expect(s.queued).toBeNull();
  });

  it('does not append a queued message to the transcript', () => {
    const s = chatReducer(initialState, { type: 'queue', content: '¿Y con 30%?' });
    expect(s.messages).toEqual([]);
  });
});

describe('truncation', () => {
  it('marks an assistant message truncated', () => {
    const s = chatReducer(initialState, { type: 'envelope', envelope, truncated: true });
    const last = s.messages.at(-1)!;
    expect(last.role).toBe('assistant');
    expect((last as { truncated?: boolean }).truncated).toBe(true);
  });

  it('leaves a complete answer unmarked', () => {
    const s = chatReducer(initialState, { type: 'envelope', envelope, truncated: false });
    expect((s.messages.at(-1) as { truncated?: boolean }).truncated).toBe(false);
  });
});

describe('reset', () => {
  const scenario: Scenario = {
    id: 'amoblado',
    cause: 'Si lo amueblas',
    value: '+S/ 250',
    unit: '/mes de alquiler',
    tone: 'good',
    note: 'Rango 200-300.',
  };

  const populated = () => {
    let s = chatReducer(initialState, { type: 'send', content: 'hola' });
    s = chatReducer(s, { type: 'envelope', envelope });
    s = chatReducer(s, { type: 'saveScenario', scenario });
    return s;
  };

  it('forgets everything, saved scenarios included', () => {
    const s = chatReducer(populated(), { type: 'reset' });
    expect(s.messages).toEqual([]);
    expect(s.fields).toEqual({});
    expect(s.savedScenarios).toEqual([]);
    expect(s.status).toBe('idle');
  });

  // Connectivity is the browser's fact, not the draft's: wiping it would hide
  // the offline banner while the connection is still down.
  it('keeps the offline flag', () => {
    let s = chatReducer(populated(), { type: 'setOffline', offline: true });
    s = chatReducer(s, { type: 'reset' });
    expect(s.offline).toBe(true);
  });

  it('restores the previous state', () => {
    const before = populated();
    const after = chatReducer(chatReducer(before, { type: 'reset' }), {
      type: 'restore',
      state: before,
    });
    expect(after).toEqual(before);
  });
});
