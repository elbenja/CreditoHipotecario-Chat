import { deriveInicial, type AnalysisEnvelope, type MortgageField, type PinnedField, type Scenario } from '@chat/shared';

export interface Candidate {
  key: string;
  label: string;
  value: string;
}

export type Message =
  | { id: string; role: 'user'; content: string }
  | {
      id: string;
      role: 'assistant';
      envelope: AnalysisEnvelope;
      truncated?: boolean;
      outOfScope?: boolean;
    }
  | { id: string; role: 'assistant-fallback'; prose: string; candidates: Candidate[]; truncated?: boolean };

export type Status = 'idle' | 'sending' | 'thinking' | 'analyzing' | 'streaming' | 'error';

export interface FieldChange {
  key: string;
  label: string;
  from: string;
  to: string;
}

export interface ChatState {
  messages: Message[];
  fields: Record<string, PinnedField>;
  baseline: Record<string, string>;
  /** Keys the user typed into the panel. Arrays, not Sets, so this serialises. */
  userEdited: string[];
  /** Model-driven changes to announce, with revert. */
  changes: FieldChange[];
  /** Model values blocked because the user owns that field. */
  proposals: Record<string, PinnedField>;
  /** Whole objects, not ids: the model reuses ids across turns. */
  savedScenarios: Scenario[];
  /** The most recent deletion, held so the undo bar can restore it. */
  lastDeleted: Scenario | null;
  status: Status;
  analyzeSteps: { label: string; done: boolean }[];
  error: ChatError | null;
  /** The browser reports no connection. */
  offline: boolean;
  /** A message typed while offline, held until the connection returns. */
  queued: string | null;
  /** Credit terms read from an uploaded schedule. Separate from `fields`:
   *  those describe the property, these describe the credit. */
  mortgage: Record<string, MortgageField>;
  /** Read but not yet confirmed. Nothing pins until the user says so. */
  pendingExtraction: MortgageField[] | null;
  /** What the last confirmed schedule did to each mortgage key: the value it
   *  replaced, or null when the key was new. A key the user has since
   *  retyped is dropped. Drives the per-row "antes X" line. */
  mortgageChanges: Record<string, string | null>;
  /** Bumped on every confirmed schedule, so a collapsed group can tell a
   *  change it has not yet shown from one it has. */
  mortgageRevision: number;
  /** The schedule being read right now, so the screen can show its progress
   *  row. Set when the read starts, cleared when it is ready to review or
   *  fails. Never persisted: a reload mid-read has no read to show. */
  attachment: { name: string; size: number } | null;
}

export interface ChatError {
  /** 'document' is the server's kind for a schedule that failed to extract —
   *  distinct from 'api' (the model call itself failing). */
  kind: 'api' | 'offline' | 'document';
  message: string;
  /** The question that failed, so "Reintentar" can resend exactly it. */
  retry: string | null;
}

export type Action =
  | { type: 'send'; content: string }
  | { type: 'status'; phase: Status }
  | { type: 'analyzeStep'; label: string }
  | { type: 'envelope'; envelope: AnalysisEnvelope; truncated?: boolean; outOfScope?: boolean }
  | { type: 'fallback'; prose: string; candidates: Candidate[]; truncated?: boolean }
  | { type: 'error'; kind: 'api' | 'offline' | 'document'; message: string; retry: string | null }
  | { type: 'clearError' }
  | { type: 'setOffline'; offline: boolean }
  | { type: 'queue'; content: string }
  | { type: 'dequeue' }
  | { type: 'editField'; key: string; value: string }
  | { type: 'editMortgageField'; key: string; value: string }
  | { type: 'revertChange'; key: string }
  | { type: 'acceptProposal'; key: string }
  | { type: 'rejectProposal'; key: string }
  | { type: 'dismissChanges' }
  | { type: 'pinCandidate'; key: string; label: string; value: string }
  | { type: 'saveScenario'; scenario: Scenario }
  | { type: 'deleteScenario'; id: string }
  | { type: 'undoDelete' }
  | { type: 'recalculate' }
  | { type: 'reset' }
  | { type: 'restore'; state: ChatState }
  | { type: 'attachStart'; name: string; size: number }
  | { type: 'extractionReady'; fields: MortgageField[] }
  | { type: 'confirmExtraction'; fields: MortgageField[] }
  | { type: 'cancelExtraction' };

export const initialState: ChatState = {
  messages: [],
  fields: {},
  baseline: {},
  userEdited: [],
  changes: [],
  proposals: {},
  savedScenarios: [],
  lastDeleted: null,
  status: 'idle',
  analyzeSteps: [],
  error: null,
  offline: false,
  queued: null,
  mortgage: {},
  pendingExtraction: null,
  attachment: null,
  mortgageChanges: {},
  mortgageRevision: 0,
};

const deriveBaseline = (fields: Record<string, PinnedField>): Record<string, string> =>
  Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, f.value]));

const omit = <T,>(obj: Record<string, T>, key: string): Record<string, T> => {
  const { [key]: _drop, ...rest } = obj;
  return rest;
};

/**
 * Ids must be unique across reloads: the app restores messages from
 * localStorage, so a counter that restarts at 0 collides with restored ids and
 * React reuses the wrong node. Also keeps the reducer pure, which StrictMode's
 * double-invocation would otherwise expose.
 */
const nextId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `m${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export function chatReducer(state: ChatState, action: Action): ChatState {
  switch (action.type) {
    case 'send':
      return {
        ...state,
        messages: [...state.messages, { id: nextId(), role: 'user', content: action.content }],
        status: 'thinking',
        analyzeSteps: [],
        error: null,
      };

    case 'status':
      return { ...state, status: action.phase };

    case 'analyzeStep':
      return {
        ...state,
        analyzeSteps: [...state.analyzeSteps, { label: action.label, done: false }],
      };

    case 'envelope': {
      // Messages are append-only: a new answer never rewrites an old one.
      const fields = { ...state.fields };
      const proposals = { ...state.proposals };
      const changes: FieldChange[] = [...state.changes];

      for (const f of action.envelope.fields) {
        const prev = fields[f.key];

        // Tier 1 — filling an empty field is the core loop. Silent.
        if (!prev) {
          fields[f.key] = f;
          continue;
        }

        if (prev.value === f.value) {
          // The user typed this value; panel edits never reach the server's
          // provenance check, so do not let the model's 'assumed' overwrite it.
          fields[f.key] = state.userEdited.includes(f.key)
            ? { ...f, provenance: prev.provenance }
            : f;
          continue;
        }

        // Tier 4 — the user typed this value. Their decision stands; the
        // model's becomes a visible proposal rather than a silent overwrite.
        if (state.userEdited.includes(f.key)) {
          proposals[f.key] = f;
          continue;
        }

        // Tiers 2 and 3 — apply, but announce it.
        changes.push({ key: f.key, label: f.label, from: prev.value, to: f.value });
        fields[f.key] = f;
      }

      return {
        ...state,
        messages: [
          ...state.messages,
          {
            id: nextId(),
            role: 'assistant',
            envelope: action.envelope,
            truncated: action.truncated ?? false,
            outOfScope: action.outOfScope ?? false,
          },
        ],
        fields,
        // Derived after arbitration, so a blocked field is not spuriously dirty.
        baseline: deriveBaseline(fields),
        changes,
        proposals,
        status: 'idle',
        analyzeSteps: state.analyzeSteps.map((s) => ({ ...s, done: true })),
      };
    }

    case 'revertChange': {
      const change = state.changes.find((c) => c.key === action.key);
      const existing = state.fields[action.key];
      if (!change || !existing) return state;

      const fields = { ...state.fields, [action.key]: { ...existing, value: change.from } };
      return {
        ...state,
        fields,
        baseline: deriveBaseline(fields),
        changes: state.changes.filter((c) => c.key !== action.key),
      };
    }

    case 'dismissChanges':
      return { ...state, changes: [] };

    case 'acceptProposal': {
      const proposed = state.proposals[action.key];
      if (!proposed) return state;

      const fields = { ...state.fields, [action.key]: proposed };
      return {
        ...state,
        fields,
        baseline: deriveBaseline(fields),
        // Accepting one proposal does not unlock the field — it stays the user's.
        proposals: omit(state.proposals, action.key),
      };
    }

    case 'rejectProposal':
      return { ...state, proposals: omit(state.proposals, action.key) };

    case 'fallback':
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            id: nextId(),
            role: 'assistant-fallback',
            prose: action.prose,
            candidates: action.candidates,
            truncated: action.truncated ?? false,
          },
        ],
        status: 'idle',
      };

    case 'error':
      // Never touch fields, savedScenarios or messages: an error must not
      // erase what the user already had. The attachment goes: whatever was
      // being read is no longer in flight.
      return {
        ...state,
        status: 'error',
        error: { kind: action.kind, message: action.message, retry: action.retry },
        attachment: null,
      };

    case 'clearError':
      return { ...state, status: 'idle', error: null };

    case 'setOffline':
      return { ...state, offline: action.offline };

    case 'queue':
      return { ...state, queued: action.content };

    case 'dequeue':
      return { ...state, queued: null };

    case 'editField': {
      const existing = state.fields[action.key];
      if (!existing) return state;
      return {
        ...state,
        fields: {
          ...state.fields,
          [action.key]: { ...existing, value: action.value, provenance: 'user' },
        },
        // Typing into a field claims it: the model may propose, not overwrite.
        userEdited: state.userEdited.includes(action.key)
          ? state.userEdited
          : [...state.userEdited, action.key],
      };
    }

    case 'editMortgageField': {
      const existing = state.mortgage[action.key];
      if (!existing) return state;
      return {
        ...state,
        mortgage: {
          ...state.mortgage,
          // Retyped, so it is no longer what the bank's schedule said.
          [action.key]: { ...existing, value: action.value, provenance: 'user' },
        },
        // And no longer "what the PDF changed" either.
        mortgageChanges: omit(state.mortgageChanges, action.key),
      };
    }

    case 'pinCandidate': {
      // The user chose this value from a chip, so it is user-stated by
      // definition, and it counts as an edit: the model may propose, not
      // overwrite.
      const field: PinnedField = {
        key: action.key as PinnedField['key'],
        label: action.label,
        value: action.value,
        provenance: 'user',
        note: '',
      };
      const fields = { ...state.fields, [action.key]: field };
      return {
        ...state,
        fields,
        baseline: deriveBaseline(fields),
        userEdited: state.userEdited.includes(action.key)
          ? state.userEdited
          : [...state.userEdited, action.key],
      };
    }

    case 'saveScenario': {
      // Saving is staging, not persistence — it reaches a database only when
      // the property is saved. Re-saving the same id keeps the first value.
      if (state.savedScenarios.some((s) => s.id === action.scenario.id)) return state;
      return { ...state, savedScenarios: [...state.savedScenarios, action.scenario] };
    }

    case 'deleteScenario': {
      const victim = state.savedScenarios.find((s) => s.id === action.id);
      if (!victim) return state;
      return {
        ...state,
        savedScenarios: state.savedScenarios.filter((s) => s.id !== action.id),
        lastDeleted: victim,
      };
    }

    case 'undoDelete': {
      if (!state.lastDeleted) return state;
      return {
        ...state,
        savedScenarios: [...state.savedScenarios, state.lastDeleted],
        lastDeleted: null,
      };
    }

    case 'recalculate':
      // Clear the dirty set as the request goes out, so the band disappears
      // immediately rather than lingering through the wait. Messages are
      // untouched — the new answer arrives as its own 'envelope' action.
      return {
        ...state,
        baseline: deriveBaseline(state.fields),
        changes: [],
        status: 'thinking',
        analyzeSteps: [],
        error: null,
      };

    case 'attachStart':
      return {
        ...state,
        attachment: { name: action.name, size: action.size },
        status: 'thinking',
        analyzeSteps: [],
        error: null,
      };

    case 'extractionReady':
      return { ...state, pendingExtraction: action.fields, status: 'idle', attachment: null };

    case 'cancelExtraction':
      return { ...state, pendingExtraction: null };

    case 'confirmExtraction': {
      // A confirmed extraction replaces the mortgage group rather than
      // merging into it: two uploads are two different credits, and merging
      // by key would let a key bank A had but B didn't survive alongside B's
      // figures, still labelled 'documento' as if it came from the same
      // schedule.
      const mortgage = Object.fromEntries(action.fields.map((f) => [f.key, f]));

      // Cards 12/13: remember what each pinned key replaced, so the panel can
      // show the change rather than just announce one. A key whose value the
      // new schedule left untouched still counts as pinned by it, but has no
      // "antes" to show.
      const mortgageChanges: Record<string, string | null> = {};
      for (const f of action.fields) {
        const prev = state.mortgage[f.key]?.value;
        mortgageChanges[f.key] = prev !== undefined && prev !== f.value ? prev : null;
      }

      // The down payment is what the buyer covers that the bank did not, so it
      // falls out of the two numbers. Never over a value the user owns.
      const fields = { ...state.fields };
      const financed = mortgage.montoFinanciado?.value;
      const inicial = deriveInicial(fields.precio?.value, financed);
      if (inicial && !state.userEdited.includes('inicial')) {
        fields.inicial = {
          key: 'inicial',
          label: 'Inicial',
          value: inicial,
          prefix: 'S/',
          // Derived, not read: the schedule never states a down payment.
          provenance: 'assumed',
          note: 'Calculada: precio menos el monto que financia el banco.',
        };
      }

      return {
        ...state,
        mortgage,
        fields,
        pendingExtraction: null,
        mortgageChanges,
        mortgageRevision: state.mortgageRevision + 1,
      };
    }

    case 'reset':
      // Everything the user ever gave us, gone — saved scenarios included.
      // `offline` survives because it is the browser's fact, not the draft's:
      // clearing it would hide the banner while the connection is still down.
      return { ...initialState, offline: state.offline };

    case 'restore':
      return action.state;

    default:
      return state;
  }
}

/** Derived, never stored. */
export function selectDirtyKeys(state: ChatState): string[] {
  return Object.keys(state.fields).filter((k) => state.fields[k]!.value !== state.baseline[k]);
}
