import type { AnalysisEnvelope, Listing, MortgageField, PinnedField, Scenario } from '@chat/shared';
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

  it('editField drops an anuncio note — it names a model the value no longer matches', () => {
    const before = {
      ...initialState,
      fields: { precio: { key: 'precio' as const, label: 'Precio', value: '363,906', prefix: 'S/', suffix: undefined, provenance: 'anuncio' as const, note: "Precio 'desde' del modelo TIPO 7" } },
    };
    const s = chatReducer(before, { type: 'editField', key: 'precio', value: '370,000' });
    expect(s.fields.precio!.note).toBe('');
    expect(s.fields.precio!.provenance).toBe('user');
  });

  it('editField keeps a non-anuncio note — it describes the field, not a specific reading', () => {
    const before = {
      ...initialState,
      fields: { tasa: { key: 'tasa' as const, label: 'Tasa', value: '8', suffix: '%', prefix: undefined, provenance: 'assumed' as const, note: 'Tasa variable' } },
    };
    const s = chatReducer(before, { type: 'editField', key: 'tasa', value: '9' });
    expect(s.fields.tasa!.note).toBe('Tasa variable');
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

describe('follow-up field questions', () => {
  it('does not keep asking for a field that the same reply already fixed', () => {
    const fixedInitial: AnalysisEnvelope = {
      ...envelope,
      kind: 'capture',
      askField: 'inicial',
      fields: [{ key: 'inicial', label: 'Cuota inicial', value: '20', suffix: '%', provenance: 'assumed', note: '' }],
      metrics: [], scenarios: [], prose: [], followUps: [],
    };
    const s = chatReducer(initialState, { type: 'envelope', envelope: fixedInitial });
    expect(s.fields.inicial?.value).toBe('20');
    expect(s.pendingField).toBeNull();
  });

  it('never turns rent into a pending question for the user', () => {
    const asksRent: AnalysisEnvelope = {
      ...envelope,
      kind: 'capture', askField: 'alquiler', fields: [], metrics: [], scenarios: [], prose: [], followUps: [],
    };
    const s = chatReducer(initialState, { type: 'envelope', envelope: asksRent });
    expect(s.pendingField).toBeNull();
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

describe('cronograma extraction', () => {
  const READ: MortgageField[] = [
    { key: 'tea', label: 'TEA', value: '8.99', suffix: '%', provenance: 'documento', note: '' },
    { key: 'montoFinanciado', label: 'Monto financiado', value: '280,000', prefix: 'S/',
      provenance: 'documento', note: '' },
  ];

  it('holds the read fields pending, without pinning them', () => {
    const s = chatReducer(initialState, { type: 'extractionReady', fields: READ });
    expect(s.pendingExtraction).toHaveLength(2);
    expect(s.mortgage).toEqual({});
  });

  it('pins them on confirm and clears the pending set', () => {
    let s = chatReducer(initialState, { type: 'extractionReady', fields: READ });
    s = chatReducer(s, { type: 'confirmExtraction', fields: READ });
    expect(s.mortgage.tea!.value).toBe('8.99');
    expect(s.pendingExtraction).toBeNull();
  });

  it('pins what the user edited in the modal, not what was read', () => {
    let s = chatReducer(initialState, { type: 'extractionReady', fields: READ });
    const corrected = [{ ...READ[0]!, value: '9.10' }, READ[1]!];
    s = chatReducer(s, { type: 'confirmExtraction', fields: corrected });
    expect(s.mortgage.tea!.value).toBe('9.10');
  });

  // A second upload is a different credit, not an update to the first one:
  // a key the first schedule had that the second omits must not survive,
  // still labelled 'documento' as if the second schedule had said it.
  it('replaces the mortgage group on a second upload instead of blending it with the first', () => {
    let s = chatReducer(initialState, { type: 'confirmExtraction', fields: READ });
    expect(s.mortgage.montoFinanciado).toBeDefined();

    const secondBank: MortgageField[] = [
      { key: 'tea', label: 'TEA', value: '11.20', suffix: '%', provenance: 'documento', note: '' },
    ];
    s = chatReducer(s, { type: 'confirmExtraction', fields: secondBank });

    expect(s.mortgage.tea!.value).toBe('11.20');
    expect(s.mortgage.montoFinanciado).toBeUndefined();
    expect(Object.keys(s.mortgage)).toEqual(['tea']);
  });

  it('pins nothing on cancel', () => {
    let s = chatReducer(initialState, { type: 'extractionReady', fields: READ });
    s = chatReducer(s, { type: 'cancelExtraction' });
    expect(s.mortgage).toEqual({});
    expect(s.pendingExtraction).toBeNull();
  });

  it('derives the down payment when the panel already holds a price', () => {
    let s = initialState;
    s = { ...s, fields: { ...s.fields, precio: {
      key: 'precio', label: 'Precio', value: '300,000', prefix: 'S/',
      provenance: 'user', note: '' } } };
    s = chatReducer(s, { type: 'confirmExtraction', fields: READ });
    expect(s.fields.inicial?.value).toBe('20,000');
    expect(s.fields.inicial?.provenance).toBe('assumed');
  });

  it('does not invent a down payment when there is no price', () => {
    const s = chatReducer(initialState, { type: 'confirmExtraction', fields: READ });
    expect(s.fields.inicial).toBeUndefined();
  });

  it('never overwrites a down payment the user typed', () => {
    let s = initialState;
    s = { ...s, fields: { ...s.fields,
      precio: { key: 'precio', label: 'Precio', value: '300,000', prefix: 'S/',
        provenance: 'user', note: '' },
      inicial: { key: 'inicial', label: 'Inicial', value: '45,000', prefix: 'S/',
        provenance: 'user', note: '' } },
      userEdited: ['inicial'] };
    s = chatReducer(s, { type: 'confirmExtraction', fields: READ });
    expect(s.fields.inicial!.value).toBe('45,000');
  });

  it('clears the mortgage group on reset', () => {
    let s = chatReducer(initialState, { type: 'confirmExtraction', fields: READ });
    s = chatReducer(s, { type: 'reset' });
    expect(s.mortgage).toEqual({});
  });
});

// Cards 12 and 13: the panel has to show *what* a confirmed schedule changed,
// not only that something did. The reducer records, per pinned key, the value
// it replaced (if any), and bumps a revision so the collapsed group can flag
// the change until it is opened.
describe('what a confirmed schedule changed', () => {
  const FIRST: MortgageField[] = [
    { key: 'tea', label: 'TEA', value: '8.00', suffix: '%', provenance: 'documento', note: '' },
    { key: 'plazoCuotas', label: 'Plazo', value: '240', suffix: 'cuotas', provenance: 'documento', note: '' },
  ];
  const SECOND: MortgageField[] = [
    { key: 'tea', label: 'TEA', value: '6.80', suffix: '%', provenance: 'documento', note: '' },
    { key: 'plazoCuotas', label: 'Plazo', value: '240', suffix: 'cuotas', provenance: 'documento', note: '' },
    { key: 'cuota', label: 'Cuota', value: '2,100', prefix: 'S/', provenance: 'documento', note: '' },
  ];

  it('marks every pinned key on a first upload, with nothing to compare against', () => {
    const s = chatReducer(initialState, { type: 'confirmExtraction', fields: FIRST });
    expect(s.mortgageChanges).toEqual({ tea: null, plazoCuotas: null });
    expect(s.mortgageRevision).toBe(1);
  });

  it('keeps the value a second upload replaced, and skips one it left as it was', () => {
    let s = chatReducer(initialState, { type: 'confirmExtraction', fields: FIRST });
    s = chatReducer(s, { type: 'confirmExtraction', fields: SECOND });
    expect(s.mortgageChanges).toEqual({ tea: '8.00', plazoCuotas: null, cuota: null });
    expect(s.mortgageRevision).toBe(2);
  });

  it('drops the mark once the user retypes that field', () => {
    let s = chatReducer(initialState, { type: 'confirmExtraction', fields: FIRST });
    s = chatReducer(s, { type: 'confirmExtraction', fields: SECOND });
    s = chatReducer(s, { type: 'editMortgageField', key: 'tea', value: '7.00' });
    expect(s.mortgageChanges.tea).toBeUndefined();
    expect(s.mortgageChanges.plazoCuotas).toBeNull();
  });

  it('clears everything on reset', () => {
    let s = chatReducer(initialState, { type: 'confirmExtraction', fields: FIRST });
    s = chatReducer(s, { type: 'reset' });
    expect(s.mortgageChanges).toEqual({});
    expect(s.mortgageRevision).toBe(0);
  });
});

describe('attachment in flight', () => {
  const FILE = { name: 'cronograma-bcp.pdf', size: 248_000 };
  const READ: MortgageField[] = [
    { key: 'tea', label: 'TEA', value: '8.99', suffix: '%', provenance: 'documento', note: '' },
  ];

  it('records the file and moves to thinking when a read starts', () => {
    const s = chatReducer(initialState, { type: 'attachStart', ...FILE });
    expect(s.attachment).toEqual(FILE);
    expect(s.status).toBe('thinking');
    expect(s.error).toBeNull();
  });

  it('clears the file once the read is ready to review', () => {
    let s = chatReducer(initialState, { type: 'attachStart', ...FILE });
    s = chatReducer(s, { type: 'extractionReady', fields: READ });
    expect(s.attachment).toBeNull();
  });

  it('clears the file when the read fails', () => {
    let s = chatReducer(initialState, { type: 'attachStart', ...FILE });
    s = chatReducer(s, { type: 'error', kind: 'document', message: 'x', retry: null });
    expect(s.attachment).toBeNull();
    expect(s.status).toBe('error');
  });

  // A prior read's error must not linger under the new file's progress row.
  it('drops a previous error when a new read starts', () => {
    let s = chatReducer(initialState, { type: 'error', kind: 'api', message: 'x', retry: null });
    s = chatReducer(s, { type: 'attachStart', ...FILE });
    expect(s.error).toBeNull();
  });
});

describe('editMortgageField', () => {
  const READ: MortgageField[] = [
    { key: 'tea', label: 'TEA', value: '8.99', suffix: '%', provenance: 'documento', note: '' },
  ];

  it('updates the value of a pinned mortgage field', () => {
    let s = chatReducer(initialState, { type: 'confirmExtraction', fields: READ });
    s = chatReducer(s, { type: 'editMortgageField', key: 'tea', value: '9.10' });
    expect(s.mortgage.tea!.value).toBe('9.10');
  });

  it('marks a retyped mortgage field as user-stated, since it is no longer what the bank sent', () => {
    let s = chatReducer(initialState, { type: 'confirmExtraction', fields: READ });
    s = chatReducer(s, { type: 'editMortgageField', key: 'tea', value: '9.10' });
    expect(s.mortgage.tea!.provenance).toBe('user');
  });

  it('is a no-op for a mortgage key that was never pinned', () => {
    const s = chatReducer(initialState, { type: 'editMortgageField', key: 'tea', value: '9.10' });
    expect(s.mortgage).toEqual({});
  });

  it('leaves the property fields untouched', () => {
    let s = initialState;
    s = { ...s, fields: { ...s.fields, precio: {
      key: 'precio', label: 'Precio', value: '300,000', prefix: 'S/', provenance: 'user', note: '' } } };
    s = chatReducer(s, { type: 'confirmExtraction', fields: READ });
    s = chatReducer(s, { type: 'editMortgageField', key: 'tea', value: '9.10' });
    expect(s.fields.precio!.value).toBe('300,000');
  });
});

const LISTING: Listing = {
  proyecto: 'ASPIRIA', constructora: 'GRUPO T&C', direccion: 'Av. El Sol Este 530', distrito: 'Barranco',
  entrega: undefined, etapa: undefined,
  modelos: [{ nombre: 'TIPO 7', area: '41.75', precioDesde: '363,906', dormitorios: '1' }],
  fuente: { host: 'nexoinmobiliario.pe' }, dudosos: [],
};

const pf = (key: PinnedField['key'], value: string, provenance: PinnedField['provenance'] = 'anuncio'): PinnedField => ({
  key, label: key, value, prefix: undefined, suffix: undefined, provenance, note: '',
});

const LISTING_FIELDS = [pf('ubicacion', 'Av. El Sol Este 530, Barranco'), pf('precio', '363,906'), pf('area', '41.75')];

describe('listing actions', () => {
  it('refuseListing records the user message and the refusal locally, staying idle', () => {
    const s = chatReducer(initialState, { type: 'refuseListing', content: 'https://urbania.pe/x', host: 'urbania.pe' });
    expect(s.status).toBe('idle');
    expect(s.messages.map((m) => m.role)).toEqual(['user', 'assistant-note']);
    expect((s.messages[1] as { content: string }).content).toContain('De urbania.pe no puedo leer el anuncio');
  });

  it('listingReady parks the read and clears the progress row', () => {
    const busy = { ...initialState, status: 'analyzing' as const, attachment: { name: 'nexoinmobiliario.pe', size: 0 } };
    const s = chatReducer(busy, { type: 'listingReady', listing: LISTING });
    expect(s.pendingListing).toBe(LISTING);
    expect(s.status).toBe('idle');
    expect(s.attachment).toBeNull();
  });

  it('cancelListing pins nothing', () => {
    const s = chatReducer({ ...initialState, pendingListing: LISTING }, { type: 'cancelListing' });
    expect(s.pendingListing).toBeNull();
    expect(s.fields).toEqual({});
  });

  it('confirmListing replaces the property as one entity and records a note', () => {
    const before = {
      ...initialState,
      pendingListing: LISTING,
      fields: { ubicacion: pf('ubicacion', 'Lince', 'assumed'), precio: pf('precio', '300,000', 'assumed'), tasa: pf('tasa', '8', 'user') },
    };
    const s = chatReducer(before, { type: 'confirmListing', fields: LISTING_FIELDS });
    expect(s.fields.ubicacion!.value).toBe('Av. El Sol Este 530, Barranco');
    expect(s.fields.precio!.value).toBe('363,906');
    expect(s.fields.area!.value).toBe('41.75');
    expect(s.fields.tasa!.value).toBe('8');
    expect(s.pendingListing).toBeNull();
    expect(s.messages.at(-1)).toMatchObject({ role: 'assistant-note' });
    expect((s.messages.at(-1) as { content: string }).content).toMatch(/del anuncio/);
  });

  it('confirmListing keeps a user-typed key and turns the listing value into a proposal', () => {
    const before = { ...initialState, userEdited: ['precio'], fields: { precio: pf('precio', '400,000', 'user') } };
    const s = chatReducer(before, { type: 'confirmListing', fields: LISTING_FIELDS });
    expect(s.fields.precio!.value).toBe('400,000');
    expect(s.proposals.precio!.value).toBe('363,906');
  });

  it('confirmListing drops an estimated alquiler and keeps a typed one', () => {
    const est = { ...initialState, fields: { alquiler: pf('alquiler', '1,500', 'market') } };
    expect(chatReducer(est, { type: 'confirmListing', fields: LISTING_FIELDS }).fields.alquiler).toBeUndefined();
    const typed = { ...initialState, fields: { alquiler: pf('alquiler', '1,500', 'user') } };
    expect(chatReducer(typed, { type: 'confirmListing', fields: LISTING_FIELDS }).fields.alquiler!.value).toBe('1,500');
  });

  it('confirmListing derives inicial from the new price and a financed amount', () => {
    const before = {
      ...initialState,
      mortgage: { montoFinanciado: { key: 'montoFinanciado' as const, label: 'Monto financiado', value: '300,000', prefix: 'S/', suffix: undefined, provenance: 'documento' as const, note: '' } },
    };
    const s = chatReducer(before, { type: 'confirmListing', fields: LISTING_FIELDS });
    expect(s.fields.inicial!.value).toBe('63,906');
    expect(s.fields.inicial!.provenance).toBe('assumed');
  });

  it('a later envelope with the same value keeps anuncio provenance and note', () => {
    const before = { ...initialState, fields: { precio: { ...pf('precio', '363,906'), note: "Precio 'desde' del modelo TIPO 7" } } };
    const s = chatReducer(before, {
      type: 'envelope',
      envelope: {
        verdict: 'ok', fields: [{ ...pf('precio', '363,906', 'assumed'), note: 'nota del modelo' }], metrics: [], scenarios: [], sources: [], prose: [], followUps: [],
      },
    });
    expect(s.fields.precio!.provenance).toBe('anuncio');
    expect(s.fields.precio!.note).toBe("Precio 'desde' del modelo TIPO 7");
  });

  it('an error of kind listing is stored as such', () => {
    const s = chatReducer(initialState, { type: 'error', kind: 'listing', message: 'x', retry: null });
    expect(s.error?.kind).toBe('listing');
  });
});
