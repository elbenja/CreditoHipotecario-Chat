import type { AnalysisEnvelope, PinnedField } from '@chat/shared';

export interface Candidate {
  key: string;
  label: string;
  value: string;
}

export type Message =
  | { id: string; role: 'user'; content: string }
  | { id: string; role: 'assistant'; envelope: AnalysisEnvelope }
  | { id: string; role: 'assistant-fallback'; prose: string; candidates: Candidate[] };

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
  savedScenarios: string[];
  status: Status;
  analyzeSteps: { label: string; done: boolean }[];
  error: string | null;
}

export type Action =
  | { type: 'send'; content: string }
  | { type: 'status'; phase: Status }
  | { type: 'analyzeStep'; label: string }
  | { type: 'envelope'; envelope: AnalysisEnvelope }
  | { type: 'fallback'; prose: string; candidates: Candidate[] }
  | { type: 'error'; message: string }
  | { type: 'editField'; key: string; value: string }
  | { type: 'revertChange'; key: string }
  | { type: 'acceptProposal'; key: string }
  | { type: 'rejectProposal'; key: string }
  | { type: 'dismissChanges' }
  | { type: 'pinCandidate'; key: string; label: string; value: string };

export const initialState: ChatState = {
  messages: [],
  fields: {},
  baseline: {},
  userEdited: [],
  changes: [],
  proposals: {},
  savedScenarios: [],
  status: 'idle',
  analyzeSteps: [],
  error: null,
};

const deriveBaseline = (fields: Record<string, PinnedField>): Record<string, string> =>
  Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, f.value]));

const omit = <T,>(obj: Record<string, T>, key: string): Record<string, T> => {
  const { [key]: _drop, ...rest } = obj;
  return rest;
};

let counter = 0;
const nextId = () => `m${++counter}`;

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
        messages: [...state.messages, { id: nextId(), role: 'assistant', envelope: action.envelope }],
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
          { id: nextId(), role: 'assistant-fallback', prose: action.prose, candidates: action.candidates },
        ],
        status: 'idle',
      };

    case 'error':
      return { ...state, status: 'error', error: action.message };

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

    default:
      return state;
  }
}

/** Derived, never stored. */
export function selectDirtyKeys(state: ChatState): string[] {
  return Object.keys(state.fields).filter((k) => state.fields[k]!.value !== state.baseline[k]);
}
