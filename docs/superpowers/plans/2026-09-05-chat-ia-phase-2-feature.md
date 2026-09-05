# Chat IA — Phase 2 (The Feature) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the pinned panel a working instrument — scenarios can be saved and deleted, editing a field marks the panel dirty and offers *Recalcular*, model-driven changes are announced and revertible, and nothing is lost to a page reload.

**Architecture:** All new state lives in the existing `chatReducer`; no state library, no backend. `savedScenarios`, `changes` and `proposals` already exist on `ChatState` — Phase 1 built the arbitration logic but rendered none of it. This phase adds the reducer actions that are missing (`saveScenario`, `deleteScenario`, `undoDelete`, `recalculate`), a `localStorage` mirror, and the four panel surfaces that expose all of it.

**Tech Stack:** React 19 · Vite 6 · Tailwind 3.4 · TypeScript 5.7 · vitest 2 (no new dependencies)

**Spec:** `docs/superpowers/specs/2026-09-04-chat-ia-datos-fijados-design.md`

**Builds on:** `feat/chat-ia-phase-1` (PR #1). This branch is stacked on it.

## Global Constraints

- **Accent `#F4BC44` (`ch-accent`) appears in exactly FOUR places in the resting Screen 2**: the nav underline, the "Lo asumí yo" legend and its dots, a trade-off scenario value, and the dirty band. Do not add a fifth resting use. **Transient feedback is a separate category** and is permitted: the composer focus ring (already built) and the save-flash on a destination slot are momentary, not resting state.
- `#475569` / `slate-600` is decorative only — it fails AA on `#0f172a` and `#1e293b`. Secondary text is `#94a3b8`.
- Motion: easing `ease-ch` (`cubic-bezier(.2,.7,.2,1)`) and durations 120/180/240ms **only**. No spring, no bounce, no `transform: scale()` on hover.
- `messages` is **append-only**. *Recalcular* appends a new assistant message; it never mutates a rendered one.
- `dirty` is **derived, never stored** — `selectDirtyKeys(state)`.
- All state must stay **JSON-serialisable** so `localStorage` round-trips it. No `Set`, no `Map`, no `Date`.
- Spanish (Peru) copy exactly as written here. Do not paraphrase or retranslate.
- `apps/web` uses extensionless relative imports (Vite resolves them). Do **not** add `.ts`/`.tsx` extensions there. The `.ts`-extension rule binds only `apps/api` and `packages/shared`.
- No new npm dependencies.
- Every commit ends with: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

## Two decisions made here, stated so they are not re-litigated

**1. `savedScenarios` stores whole `Scenario` objects, not ids.**
The spec says `savedScenarios: string[]`. That does not survive contact with the real model: it reuses ids across turns — `amoblado` appeared in three separate live responses with different values. An id-keyed store would have to look the scenario up across `messages`, and a repeated id resolves ambiguously, so the panel could show a value the user never saved. Storing the object is simpler, collision-free, and serialises. `Scenario` already carries a stable shape.

**2. *Recalcular* re-sends the same user turns with the updated fields.**
The API's `buildMessages` injects pinned fields as system context, so re-posting the existing user turns alongside the edited `fields` produces a fresh analysis grounded in the new numbers. No synthetic user message is invented, and the transcript stays honest — the user asked one question; the second answer is the same question re-answered with different assumptions.

---

### Task 1: Reducer actions for scenarios and recalculation

**Files:**
- Modify: `apps/web/src/state/chatReducer.ts`
- Test: `apps/web/src/state/chatReducer.test.ts`

**Interfaces:**
- Consumes: `Scenario` from `@chat/shared`; the existing `ChatState`, `chatReducer`, `selectDirtyKeys`.
- Produces: four new actions — `{type:'saveScenario', scenario}`, `{type:'deleteScenario', id}`, `{type:'undoDelete'}`, `{type:'recalculate'}` — plus `lastDeleted: Scenario | null` on `ChatState`. `savedScenarios` changes type from `string[]` to `Scenario[]`.

**Why `recalculate` is a reducer action at all:** clicking *Recalcular* must clear the dirty set at the moment the request goes out, so the band disappears immediately rather than lingering through a 20-second wait. It sets `baseline` from the current field values and sets status to `thinking`; `App` then fires the request.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/src/state/chatReducer.test.ts`:

```ts
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
```

Add `Scenario` to that file's import from `@chat/shared`.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --filter @chat/web test
```

Expected: FAIL — the new action types do not exist.

- [ ] **Step 3: Implement**

In `apps/web/src/state/chatReducer.ts`:

Change the import to include `Scenario`:

```ts
import type { AnalysisEnvelope, PinnedField, Scenario } from '@chat/shared';
```

Change the `savedScenarios` field on `ChatState` and add `lastDeleted`:

```ts
  /** Whole objects, not ids: the model reuses ids across turns. */
  savedScenarios: Scenario[];
  /** The most recent deletion, held so the undo bar can restore it. */
  lastDeleted: Scenario | null;
```

Add to `initialState`:

```ts
  lastDeleted: null,
```

Add to the `Action` union:

```ts
  | { type: 'saveScenario'; scenario: Scenario }
  | { type: 'deleteScenario'; id: string }
  | { type: 'undoDelete' }
  | { type: 'recalculate' }
```

Add these cases to the reducer, before `default`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm --filter @chat/web test
```

Expected: PASS. Report the actual total.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(web): scenario save/delete/undo and recalculate actions

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: localStorage draft persistence

**Files:**
- Create: `apps/web/src/state/persistence.ts`
- Test: `apps/web/src/state/persistence.test.ts`

**Interfaces:**
- Consumes: `ChatState`, `initialState` from `./chatReducer`.
- Produces: `loadState(): ChatState`, `saveState(state: ChatState): void`, `clearState(): void`, and the constant `STORAGE_KEY = 'chat-ia-draft-v1'`.

**Why:** the design has no state between "in memory" and "saved as a property", and the nav pill advertises that as *"sin guardar"*. Seven pinned fields and three saved scenarios built over ten turns are lost to a tab reload. This makes "sin guardar" mean *not yet in your portfolio* rather than *one keystroke from gone*.

**Every access must be wrapped in try/catch.** `localStorage` throws outright in some contexts (Safari private mode, blocked site data), and a storage failure must never take the app down.

- [ ] **Step 1: Write the failing tests**

`apps/web/src/state/persistence.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initialState, type ChatState } from './chatReducer';
import { STORAGE_KEY, clearState, loadState, saveState } from './persistence';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
});

const populated: ChatState = {
  ...initialState,
  messages: [{ id: 'm1', role: 'user', content: 'Depa de 250 mil' }],
  fields: {
    tasa: { key: 'tasa', label: 'Tasa TEA', value: '8.0', suffix: '%', provenance: 'user', note: 'n' },
  },
  baseline: { tasa: '8.0' },
  userEdited: ['tasa'],
  savedScenarios: [
    { id: 'amoblado', cause: 'Si lo amueblas', value: '+S/ 250', unit: '/mes', tone: 'good', note: 'Rango.' },
  ],
};

describe('persistence', () => {
  it('returns the initial state when nothing is stored', () => {
    expect(loadState()).toEqual(initialState);
  });

  it('round-trips a populated state', () => {
    saveState(populated);
    const back = loadState();
    expect(back.fields.tasa!.value).toBe('8.0');
    expect(back.savedScenarios[0]!.id).toBe('amoblado');
    expect(back.userEdited).toEqual(['tasa']);
    expect(back.messages).toHaveLength(1);
  });

  it('clears the stored draft', () => {
    saveState(populated);
    clearState();
    expect(loadState()).toEqual(initialState);
  });

  it('never persists transient status', () => {
    saveState({ ...populated, status: 'analyzing' });
    expect(loadState().status).toBe('idle');
  });

  it('never persists analyze steps or errors', () => {
    saveState({ ...populated, analyzeSteps: [{ label: 'x', done: false }], error: 'boom' });
    const back = loadState();
    expect(back.analyzeSteps).toEqual([]);
    expect(back.error).toBeNull();
  });

  it('falls back to the initial state on corrupt JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadState()).toEqual(initialState);
  });

  it('falls back to the initial state when the stored shape is wrong', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: 'nope' }));
    expect(loadState()).toEqual(initialState);
  });

  it('does not throw when localStorage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
    });
    expect(() => saveState(populated)).not.toThrow();
    expect(loadState()).toEqual(initialState);
    expect(() => clearState()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --filter @chat/web test
```

Expected: FAIL — `Cannot find module './persistence'`.

- [ ] **Step 3: Implement**

`apps/web/src/state/persistence.ts`:

```ts
import { initialState, type ChatState } from './chatReducer';

export const STORAGE_KEY = 'chat-ia-draft-v1';

/**
 * Transient fields are never persisted: restoring a page mid-"analyzing" would
 * show a spinner for a request that is not in flight.
 */
type Persisted = Omit<ChatState, 'status' | 'analyzeSteps' | 'error'>;

function isPlausible(value: unknown): value is Persisted {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.messages) &&
    Array.isArray(v.savedScenarios) &&
    Array.isArray(v.userEdited) &&
    typeof v.fields === 'object' &&
    v.fields !== null
  );
}

export function loadState(): ChatState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed: unknown = JSON.parse(raw);
    if (!isPlausible(parsed)) return initialState;
    return { ...initialState, ...parsed, status: 'idle', analyzeSteps: [], error: null };
  } catch {
    // Corrupt data, or storage blocked entirely. Start clean rather than crash.
    return initialState;
  }
}

export function saveState(state: ChatState): void {
  try {
    const { status: _s, analyzeSteps: _a, error: _e, ...persisted } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // Quota exceeded or storage blocked. A lost draft is bad; a crash is worse.
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do.
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm --filter @chat/web test
```

Expected: PASS. Report the actual total.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(web): localStorage draft persistence

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Saved-scenarios section in the panel

**Files:**
- Create: `apps/web/src/components/SavedScenarios.tsx`
- Modify: `apps/web/src/components/PinnedPanel.tsx`

**Interfaces:**
- Consumes: `Scenario` from `@chat/shared`; `Icon` from `./Icon`.
- Produces: `<SavedScenarios scenarios onDelete />`. `PinnedPanel` gains `savedScenarios: Scenario[]` and `onDeleteScenario: (id: string) => void`, rendering `<SavedScenarios>` inside its scrollable middle band, below the field rows.

**Design values (from the handoff):**
- Divider row, margin `16px 0 12px`: label "Escenarios guardados" (600 10px `.1em` uppercase `#64748b`) + 1px rule + right-aligned count — `1 guardado` / `N guardados`.
- Saved card: `padding: 12px 13px`, radius 10, **`bg #1e293b` filled** — the contrast against the in-chat card's `#0f172a` outline is what signals "committed" — `border 1px solid rgba(255,255,255,.06)`, `box-shadow: inset 0 1px 0 rgba(255,255,255,.04)`, gap 8 between cards.
- Card contents: cause label (600 10px `.08em` uppercase `#64748b`) → value (Plus Jakarta 700 17px, tabular) → a 24px delete button, radius 6, icon `delete-02` 14px, `#64748b` → hover `#f87171` on `#0f172a`.
- Empty state: `border 1px solid #1e293b`, radius 10, `padding: 14px`, 11.5px/1.5 `#64748b`, copy exactly: "Guarda acá los escenarios que no quieras perder. Se van con la propiedad cuando la guardes."

- [ ] **Step 1: Implement the component**

`apps/web/src/components/SavedScenarios.tsx`:

```tsx
import type { Scenario } from '@chat/shared';
import { Icon } from './Icon';

export function SavedScenarios({
  scenarios,
  onDelete,
}: {
  scenarios: Scenario[];
  onDelete: (id: string) => void;
}) {
  return (
    <section className="mb-3 mt-4 px-3">
      <div className="mb-3 flex items-center gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-500">
          Escenarios guardados
        </span>
        <div className="h-px flex-1 bg-ch-border" />
        {scenarios.length > 0 && (
          <span className="text-[11px] font-medium text-slate-400">
            {scenarios.length} {scenarios.length === 1 ? 'guardado' : 'guardados'}
          </span>
        )}
      </div>

      {scenarios.length === 0 ? (
        <p className="rounded-[10px] border border-ch-border p-[14px] text-[11.5px] leading-[1.5] text-slate-500">
          Guarda acá los escenarios que no quieras perder. Se van con la propiedad cuando la
          guardes.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {scenarios.map((s) => (
            <div
              key={s.id}
              data-saved-scenario={s.id}
              /* Filled #1e293b, not the in-chat card's #0f172a outline. That
                 contrast is what signals "committed". */
              className="flex items-center gap-2 rounded-[10px] border border-white/[.06] bg-ch-card px-[13px] py-3 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[10px] font-semibold uppercase tracking-[.08em] text-slate-500">
                  {s.cause}
                </div>
                <div className="tnum mt-1 font-jakarta text-[17px] font-bold tracking-[-.02em] text-white">
                  {s.value}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onDelete(s.id)}
                aria-label={`Borrar escenario ${s.cause}`}
                className="grid h-6 w-6 flex-none place-items-center rounded-md text-slate-500 transition-colors duration-120 ease-ch hover:bg-ch-panel hover:text-ch-neg"
              >
                <Icon name="delete-02" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Wire it into the panel**

In `apps/web/src/components/PinnedPanel.tsx`, add the import:

```tsx
import type { PinnedField, Scenario } from '@chat/shared';
import { SavedScenarios } from './SavedScenarios';
```

Extend the props:

```tsx
  savedScenarios = [],
  onDeleteScenario,
```

with types:

```tsx
  savedScenarios?: Scenario[];
  onDeleteScenario?: (id: string) => void;
```

Inside the scrollable middle band, immediately AFTER the `fields.map(...)` block and still inside that scrolling `div`, render:

```tsx
        <SavedScenarios scenarios={savedScenarios} onDelete={(id) => onDeleteScenario?.(id)} />
```

- [ ] **Step 3: Verify visually**

Temporarily pass two scenarios and an empty array to `PinnedPanel` in `App.tsx`, then:

```bash
pnpm --filter @chat/web dev
```

Check: the divider reads "ESCENARIOS GUARDADOS" with a count on the right; saved cards are **filled** and visibly lighter than the outline cards in the transcript; the delete button turns red on hover; with zero scenarios the empty-state sentence shows instead of the count. Revert the temporary `App.tsx` change.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(web): saved scenarios section in the pinned panel

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Dirty band and Recalcular

**Files:**
- Create: `apps/web/src/components/DirtyBand.tsx`
- Modify: `apps/web/src/components/PinnedPanel.tsx`

**Interfaces:**
- Consumes: `PinnedField` from `@chat/shared`; `Icon`.
- Produces: `<DirtyBand fields dirtyKeys onRecalculate />`, plus `describeDirty(fields, dirtyKeys): string` exported for testing. `PinnedPanel` gains `dirtyKeys: string[]` and `onRecalculate: () => void`, rendering the band in its fixed footer directly above the primary CTA.

**Design values:**
- Band: `padding: 13px 14px`, radius 10, `bg rgba(244,188,68,.09)`, `border 1px solid rgba(244,188,68,.22)`, entering with a 180ms fade + 4px rise.
- Message: 500 12px/1.5 `#F4BC44`.
- *Recalcular* pill: `height 40px`, radius 9999, `bg #F4BC44`, 600 13px `#0b0f1a`, `refresh` icon, full width, margin-top 10.
- **This band is one of the four permitted resting uses of the accent.**

**The message is Spanish prose, not a list.** One changed field reads *"Cambiaste la tasa."*; two read *"Cambiaste la tasa y la cuota inicial."*; three or more use commas with a final *"y"*. It always ends with *"Los números de arriba son de antes."*

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/DirtyBand.test.ts`:

```ts
import type { PinnedField } from '@chat/shared';
import { describe, expect, it } from 'vitest';
import { describeDirty } from './DirtyBand';

const fields: Record<string, PinnedField> = {
  tasa: { key: 'tasa', label: 'Tasa TEA', value: '8', provenance: 'user', note: '' },
  inicial: { key: 'inicial', label: 'Cuota inicial', value: '20', provenance: 'assumed', note: '' },
  plazo: { key: 'plazo', label: 'Plazo', value: '20', provenance: 'assumed', note: '' },
};

describe('describeDirty', () => {
  it('names a single changed field', () => {
    expect(describeDirty(fields, ['tasa'])).toBe(
      'Cambiaste la tasa. Los números de arriba son de antes.',
    );
  });

  it('joins two changed fields with y', () => {
    expect(describeDirty(fields, ['tasa', 'inicial'])).toBe(
      'Cambiaste la tasa y la cuota inicial. Los números de arriba son de antes.',
    );
  });

  it('uses commas and a final y for three', () => {
    expect(describeDirty(fields, ['tasa', 'inicial', 'plazo'])).toBe(
      'Cambiaste la tasa, la cuota inicial y el plazo. Los números de arriba son de antes.',
    );
  });

  it('returns an empty string when nothing is dirty', () => {
    expect(describeDirty(fields, [])).toBe('');
  });

  it('ignores a key with no matching field', () => {
    expect(describeDirty(fields, ['tasa', 'fantasma'])).toBe(
      'Cambiaste la tasa. Los números de arriba son de antes.',
    );
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
pnpm --filter @chat/web test
```

Expected: FAIL — `Cannot find module './DirtyBand'`.

- [ ] **Step 3: Implement**

`apps/web/src/components/DirtyBand.tsx`:

```tsx
import type { PinnedField } from '@chat/shared';
import { Icon } from './Icon';

/** Spanish articles for the field labels the panel can show. */
const ARTICLE: Record<string, string> = {
  ubicacion: 'la ubicación',
  precio: 'el precio',
  area: 'el área',
  tasa: 'la tasa',
  inicial: 'la cuota inicial',
  plazo: 'el plazo',
  alquiler: 'el alquiler',
};

export function describeDirty(
  fields: Record<string, PinnedField>,
  dirtyKeys: string[],
): string {
  const names = dirtyKeys.filter((k) => fields[k]).map((k) => ARTICLE[k] ?? fields[k]!.label);
  if (names.length === 0) return '';

  const joined =
    names.length === 1
      ? names[0]!
      : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]!}`;

  return `Cambiaste ${joined}. Los números de arriba son de antes.`;
}

export function DirtyBand({
  fields,
  dirtyKeys,
  onRecalculate,
  busy = false,
}: {
  fields: Record<string, PinnedField>;
  dirtyKeys: string[];
  onRecalculate: () => void;
  busy?: boolean;
}) {
  const message = describeDirty(fields, dirtyKeys);
  if (!message) return null;

  return (
    <div className="ch-line mb-3">
      {/* One of the four permitted resting uses of the accent. */}
      <div className="rounded-[10px] border border-[rgba(244,188,68,.22)] bg-[rgba(244,188,68,.09)] px-[14px] py-[13px]">
        <p className="text-[12px] font-medium leading-[1.5] text-ch-accent">{message}</p>
      </div>
      <button
        type="button"
        onClick={onRecalculate}
        disabled={busy}
        className="mt-[10px] flex h-10 w-full items-center justify-center gap-2 rounded-full bg-ch-accent text-[13px] font-semibold text-ch-bg transition-opacity duration-120 ease-ch hover:opacity-90 active:translate-y-px active:opacity-85 disabled:opacity-50"
      >
        <Icon name="refresh" size={15} />
        Recalcular
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm --filter @chat/web test
```

Expected: PASS. Report the actual total.

- [ ] **Step 5: Wire it into the panel footer**

In `apps/web/src/components/PinnedPanel.tsx`, import it and add props `dirtyKeys?: string[]`, `onRecalculate?: () => void`, `busy?: boolean`. In the fixed footer, immediately BEFORE the "Guardar como propiedad" button, render:

```tsx
        <DirtyBand
          fields={fieldsByKey}
          dirtyKeys={dirtyKeys}
          onRecalculate={() => onRecalculate?.()}
          busy={busy}
        />
```

`PinnedPanel` currently receives `fields` as an array. Derive the lookup at the top of the component:

```tsx
  const fieldsByKey = Object.fromEntries(fields.map((f) => [f.key, f]));
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(web): dirty band and Recalcular

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Changes strip — surfacing the model's edits

**Files:**
- Create: `apps/web/src/components/ChangesStrip.tsx`
- Modify: `apps/web/src/components/PinnedPanel.tsx`

**Interfaces:**
- Consumes: `FieldChange` from `../state/chatReducer`; `Icon`.
- Produces: `<ChangesStrip changes onRevert onDismiss />`. `PinnedPanel` gains `changes: FieldChange[]`, `onRevertChange: (key: string) => void`, `onDismissChanges: () => void`, rendering the strip at the TOP of its scrollable band, above the field rows.

**Why this exists:** Phase 1 built the arbitration in the reducer but rendered none of it. When the model revises a value it already pinned, `changes` fills up and nothing tells the user. This is the surface for that.

**Deliberately neutral, not accent.** The accent is spent on its four resting uses; a fifth dilutes them. This strip uses the same information treatment as the E4 notice: `border #1e293b`, `information-circle` icon in `#94a3b8`.

- [ ] **Step 1: Implement**

`apps/web/src/components/ChangesStrip.tsx`:

```tsx
import type { FieldChange } from '../state/chatReducer';
import { Icon } from './Icon';

export function ChangesStrip({
  changes,
  onRevert,
  onDismiss,
}: {
  changes: FieldChange[];
  onRevert: (key: string) => void;
  onDismiss: () => void;
}) {
  if (changes.length === 0) return null;

  return (
    /* Neutral, not accent: the accent is spent on its four resting uses. */
    <div className="ch-line mx-3 mb-2 rounded-[10px] border border-ch-border p-3">
      <div className="flex items-center gap-2">
        <Icon name="information-circle" size={14} className="text-slate-400" />
        <span className="flex-1 text-[11.5px] font-medium text-slate-400">
          {changes.length === 1 ? 'Actualicé un dato' : `Actualicé ${changes.length} datos`}
        </span>
        <button
          type="button"
          onClick={onDismiss}
          className="text-[11px] font-medium text-slate-500 transition-colors duration-120 ease-ch hover:text-slate-300"
        >
          Entendido
        </button>
      </div>

      <ul className="mt-2 flex flex-col gap-[6px]">
        {changes.map((c) => (
          <li key={c.key} className="flex items-center gap-2 text-[11.5px]">
            <span className="text-slate-500">{c.label}</span>
            <span className="tnum text-slate-500 line-through">{c.from}</span>
            <Icon name="arrow-right-01" size={11} className="text-slate-600" />
            <span className="tnum font-semibold text-white">{c.to}</span>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => onRevert(c.key)}
              className="rounded-full border border-ch-border-hover px-[9px] py-[2px] text-[11px] font-medium text-slate-300 transition-colors duration-120 ease-ch hover:border-slate-500"
            >
              Deshacer
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the panel**

In `PinnedPanel.tsx`, import `ChangesStrip` and `type FieldChange`, add props `changes?: FieldChange[]`, `onRevertChange?: (key: string) => void`, `onDismissChanges?: () => void`, and render it as the FIRST child inside the scrollable middle band:

```tsx
        <ChangesStrip
          changes={changes}
          onRevert={(k) => onRevertChange?.(k)}
          onDismiss={() => onDismissChanges?.()}
        />
```

- [ ] **Step 3: Verify visually**

Temporarily pass a `changes` array of two entries into `PinnedPanel` from `App.tsx`, run the dev server, and confirm: the strip renders above the fields, shows `label  old → new` with the old value struck through, "Deshacer" per row and "Entendido" to dismiss, all in neutral slate with **no accent colour anywhere in the strip**. Revert the temporary change.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(web): changes strip for model-driven field edits

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Wire it all through, plus the undo bar

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/screens/Conversation.tsx`
- Create: `apps/web/src/components/UndoBar.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1-5.
- Produces: a fully wired app. `Conversation` gains `onSaveScenario`, `onDeleteScenario`, `onUndoDelete`, `onRecalculate`, `onRevertChange`, `onDismissChanges` and threads them to `AssistantAnswer` and `PinnedPanel`. `<UndoBar visible onUndo onExpire />` shows for 5s after a deletion.

**Micro-interaction 08:** after deleting, an undo bar appears for **5 seconds** — "Escenario borrado" plus an underlined "Deshacer" (600 12px `#f8fafc`). No confirmation dialog: the design is explicit that something which recomputes in a second does not get a modal.

- [ ] **Step 1: Implement the undo bar**

`apps/web/src/components/UndoBar.tsx`:

```tsx
import { useEffect } from 'react';

export function UndoBar({
  visible,
  onUndo,
  onExpire,
}: {
  visible: boolean;
  onUndo: () => void;
  onExpire: () => void;
}) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onExpire, 5000);
    return () => clearTimeout(t);
  }, [visible, onExpire]);

  if (!visible) return null;

  return (
    <div className="ch-line absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-full border border-ch-border bg-ch-card px-4 py-[10px] shadow-lg">
      <span className="text-[12px] text-slate-300">Escenario borrado</span>
      <button
        type="button"
        onClick={onUndo}
        className="text-[12px] font-semibold text-slate-50 underline underline-offset-2 transition-opacity duration-120 ease-ch hover:opacity-90"
      >
        Deshacer
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Thread the handlers through `Conversation`**

Add these props to `Conversation` and pass them down — `onSaveScenario` and `savedIds` to `AssistantAnswer`, the rest to `PinnedPanel`:

```tsx
  savedIds,
  onSaveScenario,
  onDeleteScenario,
  onRecalculate,
  onRevertChange,
  onDismissChanges,
```

`AssistantAnswer` already accepts `onSaveScenario` and `savedIds`, and `ScenarioCard` already accepts `saved` and `onSave` — Phase 1 built them but nothing passed them. Pass them now:

```tsx
                  <AssistantAnswer
                    envelope={m.envelope}
                    onFollowUp={send}
                    onSaveScenario={onSaveScenario}
                    savedIds={savedIds}
                  />
```

And the panel:

```tsx
      <PinnedPanel
        fields={Object.values(state.fields)}
        proposals={state.proposals}
        changes={state.changes}
        savedScenarios={state.savedScenarios}
        dirtyKeys={selectDirtyKeys(state)}
        busy={busy}
        onEdit={onEdit}
        onAcceptProposal={onAcceptProposal}
        onRejectProposal={onRejectProposal}
        onDeleteScenario={onDeleteScenario}
        onRecalculate={onRecalculate}
        onRevertChange={onRevertChange}
        onDismissChanges={onDismissChanges}
      />
```

Import `selectDirtyKeys` from `../state/chatReducer`. Also render `<UndoBar>` inside `Conversation`'s outer container, which must be `relative`.

- [ ] **Step 3: Wire `App.tsx`**

Replace `useReducer(chatReducer, initialState)` with the persisted initialiser, add the new dispatchers, mirror to storage, and give *Recalcular* its own request path:

```tsx
  const [state, dispatch] = useReducer(chatReducer, undefined, loadState);

  // Mirror every mutation so a reload does not lose the draft.
  useEffect(() => {
    saveState(state);
  }, [state]);
```

Extract the request into a helper both `send` and `recalculate` use — *Recalcular* re-sends the SAME user turns with the UPDATED fields, per this plan's decision 2:

```tsx
  const request = useCallback(
    async (turns: { role: 'user'; content: string }[], fields: PinnedField[]) => {
      await streamChat({ messages: turns, fields }, (e) => {
        const data = e.data as Record<string, never>;
        if (e.event === 'status') dispatch({ type: 'status', phase: data.phase });
        else if (e.event === 'analyzeStep') dispatch({ type: 'analyzeStep', label: data.label });
        else if (e.event === 'envelope') dispatch({ type: 'envelope', envelope: data.envelope });
        else if (e.event === 'fallback')
          dispatch({ type: 'fallback', prose: data.prose, candidates: data.candidates });
        else if (e.event === 'error') dispatch({ type: 'error', message: data.message });
      });
    },
    [],
  );

  const send = useCallback(
    async (text: string) => {
      dispatch({ type: 'send', content: text });
      const turns = [...toTurns(state.messages), { role: 'user' as const, content: text }];
      await request(turns, Object.values(state.fields));
    },
    [state.messages, state.fields, request],
  );

  const recalculate = useCallback(async () => {
    dispatch({ type: 'recalculate' });
    await request(toTurns(state.messages), Object.values(state.fields));
  }, [state.messages, state.fields, request]);
```

Add the remaining dispatchers with `useCallback`: `saveScenario(scenario)`, `deleteScenario(id)`, `undoDelete()`, `revertChange(key)`, `dismissChanges()`. Pass `savedIds={state.savedScenarios.map((s) => s.id)}` to `Conversation`.

- [ ] **Step 4: Verify the whole flow in a browser**

Start both servers:

```bash
pnpm dev
```

At `http://localhost:5173`, in order:

1. Ask: `Depa de 250 mil en Pueblo Libre, 40 m2, tasa 8%. ¿Es buen negocio?` and wait for the answer.
2. Click **Guardar** on a scenario card — its label must flip to "Guardado" and the scenario must appear in the panel's saved section with the count updating.
3. Click the panel's **delete** button on that saved scenario — it disappears and the undo bar appears.
4. Click **Deshacer** within 5 seconds — the scenario returns.
5. Delete it again and wait 6 seconds — the bar disappears and the scenario stays deleted.
6. Edit the **Tasa** field in the panel — the dirty band appears reading *"Cambiaste la tasa. Los números de arriba son de antes."* with a Recalcular button.
7. Click **Recalcular** — the band clears immediately, the waiting states show, and a NEW assistant message is APPENDED. The first answer must still be present above it.
8. **Reload the page** — the transcript, the pinned fields and the saved scenarios must all still be there.

Report exactly what you observed at each numbered step.

- [ ] **Step 5: Run the full suite**

```bash
pnpm -r test && pnpm -r typecheck && pnpm --filter @chat/web build
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(web): wire scenario save/delete, Recalcular and persistence

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Micro-interactions 06, 07 and 08

**Files:**
- Modify: `apps/web/src/index.css`
- Modify: `apps/web/src/components/Composer.tsx`
- Modify: `apps/web/src/components/ScenarioCard.tsx`
- Modify: `apps/web/src/components/SavedScenarios.tsx`

**Interfaces:**
- Consumes: everything above.
- Produces: no new exports. `Composer` gains an optional `suggestions?: string[]` and `onSuggestion?: (s: string) => void`.

**06 · Composer focus.** The amber focus ring already exists from Phase 1. Add: on focus, exactly **2** contextual suggestions rise above the composer (fade + 8px, 180ms). **Two, not four** — the composer is not a menu. They hide on blur (delay the hide by 150ms so a click on a suggestion still registers).

**07 · Saving a scenario.** The card travels to the panel: 240ms, translate toward the destination, scale to `.72`, fade out; the destination slot fades in with a brief border flash. Without the travel the user never learns where saved things live. The flash is **transient**, so the accent is permitted here.

**08 · Deleting.** Collapse to zero over 180ms, animating `max-height`, `padding` and `border-width` **together** with `box-sizing: border-box` so no ghost gap remains.

- [ ] **Step 1: Add the keyframes**

Append inside the existing `@layer utilities` block in `apps/web/src/index.css`:

```css
  @keyframes ch-rise {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes ch-flash {
    0%   { border-color: #F4BC44; }
    100% { border-color: rgba(255, 255, 255, 0.06); }
  }
  @keyframes ch-collapse {
    from { max-height: 96px; padding-top: 12px; padding-bottom: 12px; border-width: 1px; opacity: 1; }
    to   { max-height: 0; padding-top: 0; padding-bottom: 0; border-width: 0; opacity: 0; }
  }
  .ch-rise     { animation: ch-rise 180ms cubic-bezier(0.2, 0.7, 0.2, 1) both; }
  .ch-flash    { animation: ch-flash 240ms cubic-bezier(0.2, 0.7, 0.2, 1) both; }
  .ch-collapse {
    animation: ch-collapse 180ms cubic-bezier(0.2, 0.7, 0.2, 1) forwards;
    box-sizing: border-box;
    overflow: hidden;
  }
```

- [ ] **Step 2: Add focus suggestions to the composer (06)**

In `Composer.tsx`, add props `suggestions?: string[]` and `onSuggestion?: (s: string) => void`, plus focus state:

```tsx
  const [focused, setFocused] = useState(false);
```

Put `onFocus={() => setFocused(true)}` and `onBlur={() => setTimeout(() => setFocused(false), 150)}` on the input of the `active` variant. Directly above that variant's returned container, render:

```tsx
      {focused && suggestions.length > 0 && (
        <div className="ch-rise mb-2 flex flex-wrap gap-2">
          {/* Exactly two. The composer is not a menu. */}
          {suggestions.slice(0, 2).map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSuggestion?.(s)}
              className="rounded-full border border-ch-border-hover px-3 py-[6px] text-[12px] font-medium text-slate-300 transition-colors duration-180 ease-ch hover:border-slate-500"
            >
              {s}
            </button>
          ))}
        </div>
      )}
```

Wrap the active variant's return in a fragment so the suggestions sit above it. In `Conversation.tsx`, pass the latest assistant message's `followUps` as `suggestions` and `send` as `onSuggestion`.

- [ ] **Step 3: Add the save travel and destination flash (07)**

In `ScenarioCard.tsx`, add a local `travelling` state. On save, set it, wait 240ms, then call `onSave`:

```tsx
  const [travelling, setTravelling] = useState(false);

  const handleSave = () => {
    if (saved || travelling) return;
    setTravelling(true);
    setTimeout(() => onSave?.(scenario.id), 240);
  };
```

Apply to the card's outer element:

```tsx
      style={
        travelling
          ? { transition: 'all 240ms cubic-bezier(.2,.7,.2,1)', transform: 'scale(.72)', opacity: 0 }
          : undefined
      }
```

and change the button's handler to `handleSave`.

In `SavedScenarios.tsx`, flash the newest card. Track the previous id list and apply `ch-flash` to any card whose id was not present on the previous render:

```tsx
  const seen = useRef<string[]>([]);
  const fresh = scenarios.filter((s) => !seen.current.includes(s.id)).map((s) => s.id);
  useEffect(() => {
    seen.current = scenarios.map((s) => s.id);
  }, [scenarios]);
```

then add `${fresh.includes(s.id) ? 'ch-flash' : ''}` to the saved card's className. Import `useEffect` and `useRef`.

- [ ] **Step 4: Add the delete collapse (08)**

In `SavedScenarios.tsx`, hold a `collapsing` id. On delete, set it, wait 180ms, then call `onDelete`:

```tsx
  const [collapsing, setCollapsing] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    setCollapsing(id);
    setTimeout(() => {
      setCollapsing(null);
      onDelete(id);
    }, 180);
  };
```

Add `${collapsing === s.id ? 'ch-collapse' : ''}` to the saved card's className and point the delete button at `handleDelete`.

- [ ] **Step 5: Verify visually**

```bash
pnpm dev
```

Check, in order: focusing the composer raises **exactly two** chips; clicking a scenario's Guardar makes the card shrink and fade before the panel entry appears with a brief amber border flash; deleting collapses the row smoothly with **no leftover gap**; the undo bar still works.

- [ ] **Step 6: Run the full suite and commit**

```bash
pnpm -r test && pnpm -r typecheck && pnpm --filter @chat/web build
```

```bash
git add -A && git commit -m "feat(web): micro-interactions 06, 07 and 08

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Phase 2 done when

- `pnpm -r test` passes, `tsc --noEmit` is clean, the web app builds.
- A scenario can be saved from the transcript and appears in the panel; the in-chat button reads "Guardado".
- A saved scenario can be deleted, and undone within 5 seconds.
- Editing a field raises the dirty band with correct Spanish prose; *Recalcular* clears it and **appends** a new assistant message with the previous one intact.
- The changes strip appears when the model revises a value it had already pinned, and "Deshacer" restores the previous value.
- Reloading the page preserves the transcript, the pinned fields and the saved scenarios.
- The accent still appears in exactly four resting places on Screen 2.

## Not in Phase 2

Phase 3 — error states E1–E5 as designed.
Phase 4 — mobile bottom sheet M1–M3.
Deferred — wiring the deterministic calculation engine (spec §4).
