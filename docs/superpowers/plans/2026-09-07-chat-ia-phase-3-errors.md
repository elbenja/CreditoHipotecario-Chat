# Chat IA — Phase 3 (Error States) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Five failures, five different treatments — and none of them ever throws away what the user already had.

**Architecture:** The API learns to distinguish *why* a turn failed (upstream error vs. a response cut off at the token limit) and says so on the wire. The reducer gains an error *kind* and an offline queue. The web app gains four small in-transcript surfaces plus one banner. Nothing is thrown away: the pinned panel, the saved scenarios and the transcript survive every one of these states — only the last turn changes.

**Tech Stack:** React 19 · Vite 6 · Tailwind 3.4 · TypeScript 5.7 · Fastify 5 · vitest 2 (no new dependencies)

**Spec:** `docs/superpowers/specs/2026-09-04-chat-ia-datos-fijados-design.md`
**Design source:** the error-state artboards E1–E5 in `Chat IA - Errores y Mobile.dc.html`

**Builds on:** `feat/chat-ia-phase-2` (PR #2), itself stacked on `feat/chat-ia-phase-1` (PR #1).

## Global Constraints

- **The rule that orders all five: an error never erases what the user already had.** The panel, the saved scenarios and the transcript stay intact in every case. Only the last turn changes.
- **Amber is not the brand accent.** These states use the system alert palette — `#f59e0b` icons, `#fcd34d` text, `rgba(49,37,15,.5)` banner fill, `rgba(245,158,11,.2)` banner border. That is a *different colour* from `#F4BC44` and does not count against the accent's four resting placements on Screen 2.
- **No red anywhere except a genuine system failure.** Red in a money app reads as "you lost money", not "try again". `#f87171` stays reserved for negative deltas and the delete-hover.
- `#475569` / `slate-600` is decorative only. Secondary text is `#94a3b8`.
- Motion: `ease-ch` (`cubic-bezier(.2,.7,.2,1)`), durations 120/180/240ms only, plus the existing 0.8s linear spinner. No spring, no scale-on-hover.
- `messages` stays append-only.
- All state stays JSON-serialisable — `localStorage` persistence must keep round-tripping.
- Spanish (Peru) copy exactly as written here. Do not paraphrase or retranslate.
- Relative imports carry an explicit `.ts` extension in `apps/api` and `packages/shared`; `apps/web` stays extensionless (Vite).
- No new npm dependencies.
- Every commit ends with: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

## What already exists, and what is actually missing

Verified in the tree before writing this:

| State | Today |
| --- | --- |
| **E1** API failed | Renders as a bare grey `<p>` of raw text. No treatment, no retry. |
| **E2** Offline | **Nothing.** No `navigator.onLine` anywhere; a send while offline just fails. |
| **E3** Truncated | **Undetectable.** `kimi.ts` returns `choices[0].message.content` and discards `finish_reason`. |
| **E4** Malformed JSON | **Working.** Prose renders, candidates become pinnable chips. Needs only styling alignment. |
| **E5** Out of scope | The guardrail returns a valid envelope, so a refusal renders like a full analysis — "Análisis" heading, verdict as a headline. The design wants one line and two chips, no icon, no box. |

---

### Task 1: Teach the API why a turn failed

**Files:**
- Modify: `apps/api/src/kimi.ts`
- Modify: `apps/api/src/routes/chat.ts`
- Test: `apps/api/src/routes/chat.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `callKimi` returns `{ content: string; truncated: boolean }` instead of a bare string. The route emits `error` events carrying a `kind` field (`'api'`), and passes `truncated` through to the client on both the `envelope` and `fallback` events.

**Why:** E3 is currently impossible to build — `finish_reason` is thrown away, so nothing downstream can know the model stopped because it hit the token ceiling rather than because it finished. E1 needs a `kind` so the client can tell an upstream failure from an offline one.

- [ ] **Step 1: Write the failing test**

Append to `apps/api/src/routes/chat.test.ts`, inside the existing `describe('POST /api/chat', ...)`:

```ts
  it('marks the envelope as truncated when the model hit the length limit', async () => {
    const app = buildServer({ callModel: async () => ({ content: JSON.stringify(envelope), truncated: true }) });
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: { messages: [{ role: 'user', content: 'Depa de 250 mil' }], fields: [] },
    });
    await app.close();
    const last = parseEvents(res.body).at(-1)!;
    expect(last.event).toBe('envelope');
    expect((last.data as { truncated: boolean }).truncated).toBe(true);
  });

  it('does not mark a complete envelope as truncated', async () => {
    const app = buildServer({ callModel: async () => ({ content: JSON.stringify(envelope), truncated: false }) });
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: { messages: [{ role: 'user', content: 'Depa de 250 mil' }], fields: [] },
    });
    await app.close();
    expect((parseEvents(res.body).at(-1)!.data as { truncated: boolean }).truncated).toBe(false);
  });

  it('tags an upstream failure with kind "api"', async () => {
    const app = buildServer({
      callModel: async () => { throw new Error('upstream down'); },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: { messages: [{ role: 'user', content: 'Depa de 250 mil' }], fields: [] },
    });
    await app.close();
    const last = parseEvents(res.body).at(-1)!;
    expect(last.event).toBe('error');
    expect((last.data as { kind: string }).kind).toBe('api');
  });
```

Every existing test in that file constructs `callModel` returning a string. Update those existing stubs to return `{ content: <the same string>, truncated: false }` — that is a required signature change, not a change of expectation, and it is the only edit permitted to existing tests.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --filter @chat/api test
```

Expected: FAIL — `callModel` returns a string, so `truncated` is undefined.

- [ ] **Step 3: Implement**

In `apps/api/src/kimi.ts`, change the return type and body of `callKimi`:

```ts
export interface ModelReply {
  content: string;
  /** The model stopped because it hit the token ceiling, not because it finished. */
  truncated: boolean;
}

/** Returns the raw assistant text. Parsing and validation belong to the pipeline. */
export async function callKimi(messages: ChatMessage[]): Promise<ModelReply> {
  const res = await getClient().chat.completions.create({
    model: MODEL,
    messages,
    // No temperature: the Moonshot models used here reject anything but 1
    // ("invalid temperature: only 1 is allowed for this model"), so let the
    // model default apply rather than sending a value it refuses.
    response_format: { type: 'json_object' },
  });
  const choice = res.choices[0];
  return {
    content: choice?.message?.content ?? '',
    truncated: choice?.finish_reason === 'length',
  };
}
```

In `apps/api/src/routes/chat.ts`, update `ServerDeps` and the handler:

```ts
export interface ServerDeps {
  callModel: (messages: ChatMessage[]) => Promise<ModelReply>;
}
```

(import `type ModelReply` from `../kimi.ts`), and in the try block:

```ts
      const { content, truncated } = await deps.callModel(buildMessages(messages, fields));
      const userTurns = messages.filter((m) => m.role === 'user').map((m) => m.content);
      const result = runPipeline(content, userTurns);

      send('status', { phase: 'streaming' });
      if (result.ok) {
        send('envelope', { envelope: result.envelope, truncated });
      } else {
        send('fallback', { prose: result.prose, candidates: result.candidates, truncated });
      }
```

and in the catch:

```ts
    } catch (err) {
      // Log the real error; the user gets Spanish, not an SDK string.
      console.error('[chat] model call failed:', err);
      send('error', { kind: 'api', message: 'Se cayó la conexión con el modelo. Tus datos siguen acá.' });
    }
```

Also update the guardrail short-circuit to send `truncated: false` alongside `REFUSAL_ENVELOPE`, and add `outOfScope: true` to that same event so the client can render E5 differently:

```ts
      send('envelope', { envelope: REFUSAL_ENVELOPE, truncated: false, outOfScope: true });
```

Finally, `apps/api/src/index.ts` and `scripts/smoke.ts` both call `callKimi` and use the result as a string. Update them to destructure `.content`.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm -r test
```

Report the ACTUAL totals.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(api): report truncation and error kind on the wire

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Model the error kinds and the offline queue in the reducer

**Files:**
- Modify: `apps/web/src/state/chatReducer.ts`
- Modify: `apps/web/src/api/streamChat.ts`
- Test: `apps/web/src/state/chatReducer.test.ts`

**Interfaces:**
- Consumes: the new wire fields from Task 1.
- Produces: `ChatError = { kind: 'api' | 'offline'; message: string; retry: string | null }` replacing `error: string | null`. New `ChatState` fields: `error: ChatError | null`, `offline: boolean`, `queued: string | null`. New actions: `{type:'error', kind, message, retry}`, `{type:'setOffline', offline}`, `{type:'queue', content}`, `{type:'dequeue'}`, `{type:'clearError'}`. `Message` gains an optional `truncated?: boolean` on the assistant variants and an `outOfScope?: boolean` on the envelope variant.

**Why `retry` is on the error and not derived:** E1 offers "Reintentar", which resends *the question that failed*. Recovering that from `messages` means guessing which turn was in flight; carrying it on the error is unambiguous.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/src/state/chatReducer.test.ts`:

```ts
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
```

The existing tests dispatch `{ type: 'envelope', envelope }` with no `truncated`. Make `truncated` OPTIONAL on the action (defaulting to `false`) so those keep passing unchanged. Existing tests asserting `s.error` is a string must be updated to the new object shape — that is a required signature change and the only edit permitted to existing tests.

- [ ] **Step 2: Run to verify they fail**

```bash
pnpm --filter @chat/web test
```

- [ ] **Step 3: Implement**

In `chatReducer.ts`:

```ts
export interface ChatError {
  kind: 'api' | 'offline';
  message: string;
  /** The question that failed, so "Reintentar" can resend exactly it. */
  retry: string | null;
}
```

Change `error: string | null` to `error: ChatError | null` on `ChatState`, and add:

```ts
  /** The browser reports no connection. */
  offline: boolean;
  /** A message typed while offline, held until the connection returns. */
  queued: string | null;
```

with `offline: false, queued: null` in `initialState`.

Change the `envelope` action to `{ type: 'envelope'; envelope: AnalysisEnvelope; truncated?: boolean; outOfScope?: boolean }` and, where the assistant message is appended, carry them:

```ts
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
```

Add `truncated?: boolean` and `outOfScope?: boolean` to the assistant variant of `Message`, and `truncated?: boolean` to the `assistant-fallback` variant (carried the same way from the `fallback` action).

Replace the `error` case and add the four new ones:

```ts
    case 'error':
      // Never touch fields, savedScenarios or messages: an error must not
      // erase what the user already had.
      return {
        ...state,
        status: 'error',
        error: { kind: action.kind, message: action.message, retry: action.retry },
      };

    case 'clearError':
      return { ...state, status: 'idle', error: null };

    case 'setOffline':
      return { ...state, offline: action.offline };

    case 'queue':
      return { ...state, queued: action.content };

    case 'dequeue':
      return { ...state, queued: null };
```

In `streamChat.ts`, the synthesised terminal error must carry a kind:

```ts
    onEvent({
      event: 'error',
      data: { kind: 'api', message: 'Se cortó la conexión antes de terminar. Intenta de nuevo.' },
    });
```

and the two `!res.ok` / network-failure paths the same way.

- [ ] **Step 4: Run to verify they pass**

```bash
pnpm -r test && pnpm -r typecheck
```

Report ACTUAL totals.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(web): model error kinds, truncation and the offline queue

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: E1 (the API failed) and E3 (the response was cut off)

**Files:**
- Create: `apps/web/src/components/ErrorNotice.tsx`
- Create: `apps/web/src/components/TruncatedNotice.tsx`
- Modify: `apps/web/src/screens/Conversation.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: `ChatError` from the reducer; `Icon`.
- Produces: `<ErrorNotice error onRetry onEdit />` and `<TruncatedNotice onContinue onShorten />`. `Conversation` gains `onRetry`, `onEditQuestion`, `onContinue`, `onShorten`.

**E1 design values.** Assistant bubble at `bg #0f172a` with `border 1px solid #334155` — one step lighter than a normal bubble, which is the whole signal. Icon `alert-02` at 16px in **`#f59e0b` amber, never red**. Title 600 13.5px `#f1f5f9`: **"No pude completar el análisis"**. Body 12.5px/1.55 `#94a3b8`: **"Se cayó la conexión con el modelo. Tus datos siguen guardados — no perdiste nada."** Two buttons, gap 9, margin-top 14: **"Reintentar"** (h34, radius 9999, `bg #f8fafc`, 600 12.5px `#0b0f1a`, `refresh` icon 14px) and **"Editar la pregunta"** (h34, radius 9999, `border 1px solid #334155`, 500 12.5px `#cbd5e1`).

**The user's question stays above it.** "Reintentar" resends it unchanged; "Editar la pregunta" puts the text back in the composer for them to change.

**E3 design values.** What the model did produce is **kept and marked valid** — throwing it away would be the worst outcome. The cut is signalled by a **fading rule**, not an ellipsis: a 1px div with `background: linear-gradient(90deg, #334155, transparent)`. Then a box at `bg #0f172a`, `border 1px solid #334155`, radius 12, padding `13px 15px`: icon `text-align-left` 15px `#94a3b8`, title 600 12.5px `#f1f5f9` **"La respuesta se cortó"**, body 12px/1.5 `#94a3b8` **"Llegó al límite de largo. Lo de arriba es válido."**, then two buttons (h32): **"Continuar"** (`bg #f8fafc`, 600 12px `#0b0f1a`) and **"Pídelo más corto"** (`border 1px solid #334155`, 500 12px `#cbd5e1`).

- [ ] **Step 1: Implement `ErrorNotice`**

`apps/web/src/components/ErrorNotice.tsx`:

```tsx
import type { ChatError } from '../state/chatReducer';
import { Icon } from './Icon';

export function ErrorNotice({
  error,
  onRetry,
  onEdit,
}: {
  error: ChatError;
  onRetry: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="ch-line flex items-start gap-[11px]">
      <img src="/assets/logo-mark.svg" alt="" className="mt-[3px] h-4 w-4 opacity-50" />
      {/* One step lighter than a normal bubble — that contrast is the signal. */}
      <div className="flex-1 rounded-xl border border-ch-border-hover bg-ch-panel px-4 py-[14px]">
        <div className="flex items-center gap-[9px]">
          {/* Amber, never red: red in a money app reads as "you lost money". */}
          <Icon name="alert-02" size={16} className="text-[#f59e0b]" />
          <span className="text-[13.5px] font-semibold text-slate-100">
            No pude completar el análisis
          </span>
        </div>
        <p className="mt-2 text-[12.5px] leading-[1.55] text-slate-400">{error.message}</p>
        <div className="mt-[14px] flex items-center gap-[9px]">
          {error.retry && (
            <button
              type="button"
              onClick={onRetry}
              className="flex h-[34px] items-center gap-[7px] rounded-full bg-slate-50 px-[15px] text-[12.5px] font-semibold text-ch-bg transition-opacity duration-120 ease-ch hover:opacity-90 active:translate-y-px"
            >
              <Icon name="refresh" size={14} />
              Reintentar
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            className="flex h-[34px] items-center rounded-full border border-ch-border-hover px-[14px] text-[12.5px] font-medium text-slate-300 transition-colors duration-180 ease-ch hover:border-slate-500"
          >
            Editar la pregunta
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement `TruncatedNotice`**

`apps/web/src/components/TruncatedNotice.tsx`:

```tsx
import { Icon } from './Icon';

export function TruncatedNotice({
  onContinue,
  onShorten,
}: {
  onContinue: () => void;
  onShorten: () => void;
}) {
  return (
    <div className="mt-3 flex flex-col gap-3">
      {/* A fading rule, not an ellipsis: the text above is valid, it just stops. */}
      <div className="h-px bg-[linear-gradient(90deg,#334155,transparent)]" />
      <div className="rounded-xl border border-ch-border-hover bg-ch-panel px-[15px] py-[13px]">
        <div className="flex items-center gap-[9px]">
          <Icon name="text-align-left" size={15} className="text-slate-400" />
          <span className="text-[12.5px] font-semibold text-slate-100">La respuesta se cortó</span>
        </div>
        <p className="mt-[7px] text-[12px] leading-[1.5] text-slate-400">
          Llegó al límite de largo. Lo de arriba es válido.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onContinue}
            className="flex h-8 items-center rounded-full bg-slate-50 px-[14px] text-[12px] font-semibold text-ch-bg transition-opacity duration-120 ease-ch hover:opacity-90 active:translate-y-px"
          >
            Continuar
          </button>
          <button
            type="button"
            onClick={onShorten}
            className="flex h-8 items-center rounded-full border border-ch-border-hover px-[13px] text-[12px] font-medium text-slate-300 transition-colors duration-180 ease-ch hover:border-slate-500"
          >
            Pídelo más corto
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Render them**

In `Conversation.tsx`, replace the bare `state.error` paragraph with:

```tsx
            {state.status === 'error' && state.error && (
              <ErrorNotice error={state.error} onRetry={onRetry} onEdit={onEditQuestion} />
            )}
```

and render `<TruncatedNotice>` immediately after an assistant message whose `truncated` is true, inside the same message wrapper.

Add the four props to `Conversation`, and in `App.tsx`:

- `onRetry` — dispatch `clearError`, then re-run the request with the same turns and current fields.
- `onEditQuestion` — dispatch `clearError` and hand the failed question back to the composer. `Conversation` owns the composer's `value` in local state (`const [value, setValue] = useState('')`), so do it with a seed prop rather than lifting the state: `App` holds `const [composerSeed, setComposerSeed] = useState<{ text: string; n: number } | null>(null)`, `onEditQuestion` sets `{ text: failedQuestion, n: n + 1 }`, and `Conversation` takes `composerSeed` plus:

```tsx
  useEffect(() => {
    if (composerSeed) setValue(composerSeed.text);
  }, [composerSeed]);
```

The counter `n` is what makes re-editing the same question twice actually re-seed; keying only on the text would make the second attempt a no-op.
- `onContinue` — send the literal follow-up `Continúa desde donde te quedaste.`
- `onShorten` — send the literal follow-up `Resúmelo más corto, por favor.`

- [ ] **Step 4: Verify visually**

```bash
pnpm dev
```

Force E1 by stopping the API server mid-request, then confirm: the amber `alert-02` (not red), the two buttons, and — critically — **the user's question and the whole right-hand panel still present**. Restart the API and confirm "Reintentar" resends and succeeds.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(web): E1 API-failure notice and E3 truncation notice

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: E2 — offline

**Files:**
- Create: `apps/web/src/components/OfflineBanner.tsx`
- Create: `apps/web/src/hooks/useOnlineStatus.ts`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/screens/Conversation.tsx`, `apps/web/src/components/Composer.tsx`

**Interfaces:**
- Consumes: the reducer's `offline` and `queued`.
- Produces: `useOnlineStatus(): boolean`; `<OfflineBanner />`. `Conversation` renders the banner under the nav, shows the queued message at 45% opacity, and disables the composer.

**Design values.** Banner: `padding: 11px 16px`, `bg rgba(49,37,15,.5)`, `border 1px solid rgba(245,158,11,.2)`, radius 10, icon `wifi-disconnected-01` 16px `#f59e0b`, text 500 12.5px **`#fcd34d`**: **"Sin conexión. Reintentando…"**, and a 14px spinner — `border 2px solid rgba(245,158,11,.25)`, `border-top-color #f59e0b`, 0.8s linear.
The queued message renders as a normal user bubble at **45% opacity** with **"Se enviará al reconectar"** below it (500 11px `#94a3b8`, right-aligned).
The composer is **disabled, not hidden** — at ~50% opacity with the placeholder "Sin conexión…".

**Why queue rather than fail:** the message is *pending*, not lost. That is the whole point of this state.

- [ ] **Step 1: Implement the hook**

`apps/web/src/hooks/useOnlineStatus.ts`:

```ts
import { useEffect, useState } from 'react';

/** Tracks the browser's connectivity. Optimistic: assumes online when unknown. */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  return online;
}
```

- [ ] **Step 2: Implement the banner**

`apps/web/src/components/OfflineBanner.tsx`:

```tsx
import { Icon } from './Icon';

export function OfflineBanner() {
  return (
    <div className="ch-line mx-14 mt-3 flex items-center gap-[10px] rounded-[10px] border border-[rgba(245,158,11,.2)] bg-[rgba(49,37,15,.5)] px-4 py-[11px]">
      <Icon name="wifi-disconnected-01" size={16} className="text-[#f59e0b]" />
      <span className="flex-1 text-[12.5px] font-medium text-[#fcd34d]">
        Sin conexión. Reintentando…
      </span>
      <span
        className="h-[14px] w-[14px] rounded-full border-2 border-[rgba(245,158,11,.25)] border-t-[#f59e0b]"
        style={{ animation: 'ch-spin .8s linear infinite' }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Wire it**

In `App.tsx`, call `useOnlineStatus()` and dispatch `setOffline` whenever it changes. When `send` is called while offline, dispatch `queue` instead of running the request. When connectivity returns and `state.queued` is set, dispatch `dequeue` and send it.

In `Conversation.tsx`: render `<OfflineBanner />` above the transcript when `state.offline`; render the queued message as a user bubble at `opacity-45` with the caption; pass `disabled={state.offline || busy}` and, when offline, the placeholder `Sin conexión…` to the `Composer`.

- [ ] **Step 4: Verify visually**

```bash
pnpm dev
```

In the browser devtools, set the network to **Offline**. Confirm: the amber banner appears, typing and sending queues the message at 45% opacity with "Se enviará al reconectar", the composer is **disabled but still visible**, and the pinned panel is untouched. Set the network back to Online and confirm the queued message sends by itself.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(web): E2 offline banner and message queue

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: E5 (out of scope) and E4 polish

**Files:**
- Create: `apps/web/src/components/OutOfScopeAnswer.tsx`
- Modify: `apps/web/src/screens/Conversation.tsx`

**Interfaces:**
- Consumes: `AnalysisEnvelope`; `Icon`.
- Produces: `<OutOfScopeAnswer envelope onFollowUp />`, rendered instead of `<AssistantAnswer>` when a message's `outOfScope` is true.

**Why:** the guardrail returns a valid envelope, so a refusal currently renders with the full "Análisis" attribution and the refusal as a headline — the visual weight of a financial analysis, for a one-line "I don't do that". The design is explicit: **no icon, no box, no long apology — one line and two ways out.** Refusing well matters as much as answering well, and the reframe keeps the conversation alive.

**E5 design values.** The logo mark at 16px, then the line at 13px/1.6 `#cbd5e1`. Then the follow-ups as pills: `padding: 7px 13px`, radius 9999, `border 1px solid #334155`, 500 12px `#cbd5e1`, gap 8, margin-top 12. Nothing else — no card, no heading, no metric grid.

**E4 polish:** the existing candidate chips get a `plus-sign` icon at 12px before the label, matching the design's artboard.

- [ ] **Step 1: Implement**

`apps/web/src/components/OutOfScopeAnswer.tsx`:

```tsx
import type { AnalysisEnvelope } from '@chat/shared';

export function OutOfScopeAnswer({
  envelope,
  onFollowUp,
}: {
  envelope: AnalysisEnvelope;
  onFollowUp: (text: string) => void;
}) {
  return (
    /* No icon, no box, no apology: one line and two ways out. Refusing well
       matters as much as answering well, and the reframe keeps the
       conversation alive. */
    <div className="ch-line flex items-start gap-[11px]">
      <img src="/assets/logo-mark.svg" alt="" className="mt-[3px] h-4 w-4" />
      <div className="flex-1">
        <p className="text-[13px] leading-[1.6] text-slate-300">{envelope.verdict}</p>
        {envelope.followUps.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {envelope.followUps.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => onFollowUp(f)}
                className="rounded-full border border-ch-border-hover px-[13px] py-[7px] text-[12px] font-medium text-slate-300 transition-colors duration-180 ease-ch hover:border-slate-500"
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Route to it**

In `Conversation.tsx`, where an assistant message is rendered, branch:

```tsx
                return (
                  <div key={m.id} className="ch-line">
                    {m.outOfScope ? (
                      <OutOfScopeAnswer envelope={m.envelope} onFollowUp={send} />
                    ) : (
                      <AssistantAnswer … />
                    )}
                  </div>
                );
```

- [ ] **Step 3: Polish E4's chips**

In the fallback-message block, add the icon inside each candidate button, before the label:

```tsx
                            <Icon name="plus-sign" size={12} />
```

and give the button `flex items-center gap-[6px]`.

- [ ] **Step 4: Verify visually**

```bash
pnpm dev
```

Ask **"¿me conviene invertir en bitcoin?"**. Confirm it renders as a plain line with two or three pills — **no "Análisis" heading, no metric cards, no box** — and that the pinned panel from any earlier conversation is untouched.

- [ ] **Step 5: Run the full suite and commit**

```bash
pnpm -r test && pnpm -r typecheck && pnpm --filter @chat/web build
```

```bash
git add -A && git commit -m "feat(web): E5 out-of-scope answer and E4 chip polish

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Phase 3 done when

- `pnpm -r test` passes, `tsc --noEmit` is clean, the web app builds.
- **E1:** an upstream failure renders the amber notice with Reintentar / Editar la pregunta, the failed question still above it, and the panel intact. Reintentar resends and succeeds.
- **E2:** going offline shows the amber banner, queues a typed message at 45% opacity with "Se enviará al reconectar", and disables — not hides — the composer. Coming back online sends it.
- **E3:** a truncated answer keeps its text, marks it valid, and offers Continuar / Pídelo más corto.
- **E4:** malformed JSON still degrades silently to prose plus pinnable chips, now with the `plus-sign` icon.
- **E5:** an out-of-scope question renders as one line and two pills — no heading, no cards, no box.
- No red anywhere in these five states. Amber `#f59e0b`/`#fcd34d` is the alert palette and is distinct from the brand accent.
- The pinned panel, saved scenarios and transcript survive all five.

## Not in Phase 3

Phase 4 — mobile bottom sheet M1–M3.
Deferred — wiring the deterministic calculation engine (spec §4).
