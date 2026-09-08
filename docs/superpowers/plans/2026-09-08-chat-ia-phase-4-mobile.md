# Chat IA Phase 4 Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Status — implemented; UX review in progress.** Phase 4 was merged to
> `main` at `9c8a016`. Verification passed with 232 tests, clean typecheck,
> a production web build, and `design-qa.md` marked `passed`. The detailed
> checklist below now records the completed implementation. New UX findings
> are follow-up work and should be captured in a separate approved plan before
> changing the Phase 4 baseline. The recorded desktop visual check used
> 1280 × 720 rather than the originally planned 1440 × 900 viewport.

**Goal:** Ship the supplied M1–M3 mobile layouts with a persistent, accessible bottom sheet while leaving the desktop chat and its data behavior unchanged.

**Architecture:** Keep `App` and `ChatState` as the single source of truth. Add one mobile-only bottom-sheet shell that renders the same panel component and handlers as desktop, then apply breakpoint-specific structure to navigation, empty state, transcript, metrics, suggestions, and field typography. Use component tests for behavior and browser captures for 390 × 844 fidelity.

**Tech Stack:** React 19, TypeScript, Vite 6, Tailwind CSS 3, Vitest, Testing Library, jsdom.

---

## File Map

- Create `apps/web/src/components/MobileBottomSheet.tsx`: collapsed M2 summary, expanded M3 overlay, gestures, focus, Escape, scroll lock.
- Create `apps/web/src/components/MobileBottomSheet.test.tsx`: sheet interaction and dynamic summary tests.
- Create `apps/web/src/screens/EmptyState.test.tsx`: M1 copy, starter-row count, and persistent summary tests.
- Create `apps/web/src/test/setup.ts`: Testing Library cleanup.
- Modify `apps/web/package.json`: add component-test dependencies.
- Modify `apps/web/vitest.config.ts`: run `.tsx` tests in jsdom with setup.
- Modify `apps/web/src/components/TopNav.tsx`: compact mobile identity/context while preserving desktop nav.
- Modify `apps/web/src/components/EmptyPanel.tsx`: hide the desktop panel on mobile.
- Modify `apps/web/src/components/PinnedPanel.tsx`: expose mobile presentation without duplicating panel behavior.
- Modify `apps/web/src/components/PinnedField.tsx`: M3 field type sizing.
- Modify `apps/web/src/components/AssistantAnswer.tsx`: horizontal mobile metrics and follow-up rows.
- Modify `apps/web/src/components/MetricCard.tsx`: 150px mobile cards.
- Modify `apps/web/src/screens/EmptyState.tsx`: M1 ordering, copy, starter rows, composer, summary.
- Modify `apps/web/src/screens/Conversation.tsx`: integrate the mobile sheet and mobile spacing.
- Modify `apps/web/src/index.css`: safe areas, hidden scrollbars, sheet transitions, reduced motion.
- Create `design-qa.md`: final reference-versus-build QA record.

### Task 1: Add the component-test harness

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/vitest.config.ts`
- Create: `apps/web/src/test/setup.ts`

- [x] **Step 1: Install only the test dependencies needed for DOM interaction**

Run:

```bash
pnpm --filter @chat/web add -D @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

Expected: `apps/web/package.json` and `pnpm-lock.yaml` add the four dev dependencies without changing runtime dependencies.

- [x] **Step 2: Configure Vitest for React component tests**

Replace `apps/web/vitest.config.ts` with:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

Create `apps/web/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());
```

- [x] **Step 3: Verify the existing web suite still passes in jsdom**

Run: `pnpm --filter @chat/web test`

Expected: all existing web tests pass.

- [x] **Step 4: Commit the harness**

```bash
git add apps/web/package.json apps/web/vitest.config.ts apps/web/src/test/setup.ts pnpm-lock.yaml
git commit -m "test(web): add component test harness"
```

### Task 2: Implement M1 mobile empty state

**Files:**
- Create: `apps/web/src/screens/EmptyState.test.tsx`
- Modify: `apps/web/src/screens/EmptyState.tsx`
- Modify: `apps/web/src/components/TopNav.tsx`
- Modify: `apps/web/src/components/EmptyPanel.tsx`

- [x] **Step 1: Write the failing M1 component test**

Create `apps/web/src/screens/EmptyState.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders the M1 mobile copy, three starter rows, and empty data summary', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<EmptyState onSubmit={onSubmit} />);

    expect(screen.getByText(/Voy fijando los datos abajo/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^¿/ })).toHaveLength(3);
    expect(screen.getByText('Ningún dato fijado todavía')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '¿Es un buen negocio?' }));
    expect(onSubmit).toHaveBeenCalledWith('¿Es un buen negocio?');
  });
});
```

- [x] **Step 2: Run the test and confirm the current desktop-only screen fails it**

Run: `pnpm --filter @chat/web test -- EmptyState.test.tsx`

Expected: FAIL because the mobile copy and summary do not exist and four suggestion buttons render.

- [x] **Step 3: Add the M1 layout with responsive desktop fallbacks**

Refactor `EmptyState.tsx` so the heading is shared and each breakpoint owns an explicit, correctly ordered controls block:

```tsx
import { Icon } from '../components/Icon';

const MOBILE_SUGGESTIONS = SUGGESTIONS.slice(0, 3);

// Inside the screen root:
<div className="flex min-h-0 flex-1 flex-col md:flex-row">
  <main className="flex min-h-0 flex-1 flex-col px-5 pb-0 pt-3 md:justify-center md:px-14">
    <div className="mx-auto flex min-h-0 w-full max-w-transcript flex-1 flex-col justify-center">
      <h1 className="font-jakarta text-[27px] font-extrabold leading-[1.18] tracking-[-.03em] text-white md:text-[32px] md:leading-[1.2]">
        ¿Qué depa estás evaluando?
      </h1>
      <p className="mt-[10px] text-[13.5px] leading-[1.6] text-slate-400 md:mt-3 md:text-[14.5px]">
        <span className="md:hidden">Cuéntamelo en tus palabras. Voy fijando los datos abajo y los puedes corregir cuando quieras.</span>
        <span className="hidden md:inline">Cuéntamelo en tus palabras. Voy fijando los datos a la derecha y los puedes corregir cuando quieras.</span>
      </p>
      <div className="md:hidden">
        <div className="mb-3 mt-7 text-[10px] font-semibold uppercase tracking-[.1em] text-slate-500">O empieza por una pregunta</div>
        <div className="flex flex-col gap-2">
          {MOBILE_SUGGESTIONS.map((suggestion) => (
            <button key={suggestion} type="button" onClick={() => onSubmit(suggestion)} className="min-h-11 rounded-xl border border-ch-border-hover px-[15px] text-left text-[13.5px] font-medium text-slate-300">
              {suggestion}
            </button>
          ))}
        </div>
        <div className="mt-7">
          <Composer variant="empty" value={value} onChange={setValue} onSubmit={() => onSubmit(value)} placeholder="Describe tu depa…" />
        </div>
      </div>
      <div className="hidden md:block">
        <div className="mt-[26px]">
          <Composer variant="empty" value={value} onChange={setValue} onSubmit={() => onSubmit(value)} placeholder="Depa de 250 mil en Pueblo Libre, 40 m², tasa 8%…" />
        </div>
        <div className="mb-[14px] mt-[30px] text-[10px] font-semibold uppercase tracking-[.1em] text-slate-500">O empieza por una pregunta</div>
        <div className="flex flex-wrap gap-[9px]">
          {SUGGESTIONS.map((suggestion) => (
            <Pill key={suggestion} onClick={() => onSubmit(suggestion)}>{suggestion}</Pill>
          ))}
        </div>
      </div>
    </div>
  </main>
  <EmptyPanel />
  <div className="mobile-safe-bottom flex min-h-[62px] flex-none items-center gap-3 border-t border-ch-border px-5 text-[12.5px] font-medium text-slate-400 md:hidden">
    <span className="flex-1">Ningún dato fijado todavía</span>
    <Icon name="arrow-up-01" size={16} className="text-ch-border-hover" />
  </div>
</div>
```

Do not alter submit behavior; both breakpoint blocks share the same controlled `value` state and callbacks.

In `EmptyPanel.tsx`, change the aside class to `hidden w-panel flex-none flex-col border-l border-ch-border px-[22px] py-6 md:flex`.

In `TopNav.tsx`, preserve its prop and desktop content, but render a mobile-safe header. When `context` is present, split it once at ` · ` and show title/subtitle on mobile; otherwise show the wordmark. Hide the POC pill and desktop context pill below `md`:

```tsx
const [mobileTitle, mobileSubtitle] = context?.split(' · ') ?? [];

<header className="mobile-safe-top flex min-h-[60px] flex-none items-center gap-[9px] border-b border-ch-border px-5 md:h-nav md:px-6">
  <img src="/assets/logo-mark.svg" alt="" className="h-[18px] w-[18px] md:h-[22px] md:w-[22px]" />
  {context ? (
    <div className="min-w-0 flex-1 md:hidden">
      <div className="truncate text-[13px] font-semibold text-white">{mobileTitle}</div>
      <div className="text-[11px] font-medium text-slate-400">{mobileSubtitle}</div>
    </div>
  ) : (
    <span className="font-jakarta text-[13px] font-bold tracking-[-.02em] text-white md:text-[13.5px]">créditohipotecar.io</span>
  )}
  <span className="hidden font-jakarta text-[13.5px] font-bold tracking-[-.02em] text-white md:inline">{context && 'créditohipotecar.io'}</span>
  <div className="flex-1" />
  {context && (
    <span className="hidden items-center gap-[6px] rounded-full border border-ch-border px-3 py-[6px] text-[11.5px] text-slate-400 md:flex">
      <Icon name="home-01" size={13} />
      {context}
    </span>
  )}
  <span className="hidden rounded-full border border-ch-border px-3 py-[6px] text-[11.5px] text-slate-400 md:inline">
    números indicativos · POC
  </span>
  <div className="grid h-7 w-7 place-items-center rounded-md bg-ch-border-hover text-[11px] font-bold text-white md:hidden">JC</div>
</header>
```

- [x] **Step 4: Run the M1 and existing web tests**

Run: `pnpm --filter @chat/web test`

Expected: all tests pass.

- [x] **Step 5: Commit M1**

```bash
git add apps/web/src/screens/EmptyState.tsx apps/web/src/screens/EmptyState.test.tsx apps/web/src/components/TopNav.tsx apps/web/src/components/EmptyPanel.tsx
git commit -m "feat(web): add phase 4 mobile empty state"
```

### Task 3: Build the accessible M2–M3 bottom sheet

**Files:**
- Create: `apps/web/src/components/MobileBottomSheet.test.tsx`
- Create: `apps/web/src/components/MobileBottomSheet.tsx`
- Modify: `apps/web/src/components/PinnedPanel.tsx`
- Modify: `apps/web/src/components/PinnedField.tsx`
- Modify: `apps/web/src/index.css`

- [x] **Step 1: Write failing behavior tests for summary data, open, Escape, and focus return**

Create `apps/web/src/components/MobileBottomSheet.test.tsx`:

```tsx
import type { PinnedField, Scenario } from '@chat/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MobileBottomSheet } from './MobileBottomSheet';

const fields: PinnedField[] = [
  { key: 'precio', label: 'Precio', value: '250,000', prefix: 'S/', provenance: 'user', note: '' },
  { key: 'inicial', label: 'Cuota inicial', value: '10', suffix: '%', provenance: 'assumed', note: '' },
  { key: 'alquiler', label: 'Alquiler', value: '1,750', prefix: 'S/', provenance: 'market', note: '' },
];

const savedScenarios: Scenario[] = [
  { id: 'amoblado', cause: 'Si lo amueblas', value: '+S/ 250', unit: '/mes', tone: 'good', note: 'Rango 200–300.' },
];

describe('MobileBottomSheet', () => {
  it('summarizes the panel and restores focus after Escape closes it', async () => {
    const user = userEvent.setup();
    render(<MobileBottomSheet fields={fields} savedScenarios={savedScenarios} onEdit={vi.fn()} />);

    expect(screen.getByText('3 datos fijados')).toBeInTheDocument();
    expect(screen.getByText('2 los asumí yo · 1 escenario guardado')).toBeInTheDocument();

    const trigger = screen.getByRole('button', { name: /Abrir datos de la operación/ });
    await user.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Datos de la operación' })).toBeInTheDocument();
    expect(document.body).toHaveStyle({ overflow: 'hidden' });

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body).not.toHaveStyle({ overflow: 'hidden' });
  });

  it('forwards field edits and recalculation through the shared panel', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onRecalculate = vi.fn();
    render(
      <MobileBottomSheet
        fields={fields}
        savedScenarios={savedScenarios}
        dirtyKeys={['precio']}
        onEdit={onEdit}
        onRecalculate={onRecalculate}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Abrir datos de la operación/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Precio' }), { target: { value: '260000' } });
    expect(onEdit).toHaveBeenLastCalledWith('precio', '260000');
    await user.click(screen.getByRole('button', { name: /Recalcular/ }));
    expect(onRecalculate).toHaveBeenCalledOnce();
  });
});
```

- [x] **Step 2: Run the test and confirm it fails because the component does not exist**

Run: `pnpm --filter @chat/web test -- MobileBottomSheet.test.tsx`

Expected: FAIL with module-not-found for `./MobileBottomSheet`.

- [x] **Step 3: Add a mobile mode to the shared panel shell**

Add `mode?: 'desktop' | 'mobile'` to `PinnedPanel`. Use these structural classes:

```tsx
const mobile = mode === 'mobile';

<aside
  className={mobile
    ? 'flex h-full min-h-0 w-full flex-col bg-ch-panel'
    : 'hidden w-panel flex-none flex-col border-l border-ch-border md:flex'}
>
  <div className={`flex-none border-b border-ch-border ${mobile ? 'px-5 pb-[14px] pt-0' : 'px-[22px] pb-4 pt-[22px]'}`}>
    <div className="flex items-baseline justify-between">
      <span className={`${mobile ? 'text-[11px] text-slate-400' : 'text-[10px] text-slate-500'} font-semibold uppercase tracking-[.1em]`}>Datos de la operación</span>
      <span className="text-[11.5px] font-medium text-slate-400">{fields.length} fijados</span>
    </div>
    <div className="mt-[11px] flex items-center gap-[14px]">
      <span className="flex items-center gap-[6px] text-[11px] font-medium text-slate-400"><span className="h-[7px] w-[7px] rounded-full bg-slate-400" />Lo dijiste tú</span>
      <span className="flex items-center gap-[6px] text-[11px] font-medium text-ch-accent"><span className="h-[7px] w-[7px] rounded-full bg-ch-accent" />Lo asumí yo</span>
    </div>
  </div>
  <div className={`min-h-0 flex-1 overflow-y-auto ${mobile ? 'px-[14px] py-1' : 'px-[10px] py-2'}`}>
    <ChangesStrip changes={changes} onRevert={(key) => onRevertChange?.(key)} onDismiss={() => onDismissChanges?.()} />
    {fields.map((field) => (
      <PinnedFieldRow key={field.key} field={field} proposal={proposals[field.key]} onChange={onEdit} onAcceptProposal={onAcceptProposal} onRejectProposal={onRejectProposal} />
    ))}
    <SavedScenarios scenarios={savedScenarios} onDelete={(id) => onDeleteScenario?.(id)} />
  </div>
  <div className={`flex-none border-t border-ch-border ${mobile ? 'mobile-safe-bottom px-5 pb-[14px] pt-[14px]' : 'px-[22px] pb-6 pt-4'}`}>
    <DirtyBand fields={fieldsByKey} dirtyKeys={dirtyKeys} onRecalculate={() => onRecalculate?.()} busy={busy} />
    <button className={`flex w-full items-center justify-center gap-2 rounded-full bg-slate-50 font-semibold text-ch-bg ${mobile ? 'h-[50px] text-[14.5px]' : 'h-[46px] text-[13.5px]'}`}>
      <Icon name="plus-sign" size={mobile ? 17 : 15} />
      Guardar como propiedad
    </button>
    {!mobile && <p className="mt-2 text-center text-[11px] font-medium text-slate-400">Entra a tu portafolio y podrás amortizar sobre ella.</p>}
  </div>
</aside>
```

Import `Icon` into `PinnedPanel`. In `PinnedField.tsx`, add `text-[11px] md:text-[10px]` to labels, `text-[18px] md:text-[17px]` to inputs, `text-[15px] md:text-[14px]` to prefix/suffix, and `text-[11.5px] md:text-[11px]` to notes.

- [x] **Step 4: Implement `MobileBottomSheet`**

Create `MobileBottomSheet.tsx` with this interface:

```ts
type MobileBottomSheetProps = Omit<ComponentProps<typeof PinnedPanel>, 'mode'> & {
  fields: PinnedField[];
  savedScenarios: Scenario[];
};
```

Implementation requirements:

```tsx
const [open, setOpen] = useState(false);
const triggerRef = useRef<HTMLButtonElement>(null);
const closeRef = useRef<HTMLButtonElement>(null);
const dragStartY = useRef<number | null>(null);
const assumedCount = fields.filter((field) => field.provenance !== 'user').length;

useEffect(() => {
  if (!open) return;
  const previous = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  closeRef.current?.focus();
  const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
  window.addEventListener('keydown', onKeyDown);
  return () => {
    document.body.style.overflow = previous;
    window.removeEventListener('keydown', onKeyDown);
    triggerRef.current?.focus();
  };
}, [open]);

const beginDrag = (event: React.PointerEvent) => {
  dragStartY.current = event.clientY;
};
const endDrag = (event: React.PointerEvent) => {
  if (dragStartY.current === null) return;
  const delta = event.clientY - dragStartY.current;
  if (!open && delta < -40) setOpen(true);
  if (open && delta > 40) setOpen(false);
  dragStartY.current = null;
};
```

The collapsed trigger is `md:hidden`, at least 96px high including safe-area padding, labelled `Abrir datos de la operación`, and sets `aria-expanded={open}`. Its visible copy is dynamic:

```tsx
<div className="text-[13px] font-semibold text-white">{fields.length} datos fijados</div>
<div className="mt-0.5 text-[11.5px] font-medium text-slate-400">
  {assumedCount} {assumedCount === 1 ? 'lo asumí yo' : 'los asumí yo'} · {savedScenarios.length} {savedScenarios.length === 1 ? 'escenario guardado' : 'escenarios guardados'}
</div>
```

When open, render a fixed `md:hidden` overlay with a dismissible scrim and a bottom-aligned `h-[88dvh]` dialog. The 44px close/grabber button owns `ref={closeRef}`, `aria-label="Cerrar datos de la operación"`, and the pointer handlers. Inside it render:

```tsx
<PinnedPanel {...panelProps} fields={fields} savedScenarios={savedScenarios} mode="mobile" />
```

- [x] **Step 5: Add safe-area and motion utilities**

Append to `index.css`:

```css
.mobile-safe-top { padding-top: env(safe-area-inset-top); }
.mobile-safe-bottom { padding-bottom: max(14px, env(safe-area-inset-bottom)); }
.ch-scrollbar-none { scrollbar-width: none; }
.ch-scrollbar-none::-webkit-scrollbar { display: none; }
.ch-sheet-enter { animation: ch-sheet-enter 240ms cubic-bezier(.2,.7,.2,1) both; }
@keyframes ch-sheet-enter { from { transform: translateY(100%); } to { transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) {
  .ch-sheet-enter { animation: none; }
}
```

- [x] **Step 6: Run the sheet test and complete web suite**

Run: `pnpm --filter @chat/web test`

Expected: all tests pass, including open/close, summary count, body scroll lock, and focus return.

- [x] **Step 7: Commit the sheet**

```bash
git add apps/web/src/components/MobileBottomSheet.tsx apps/web/src/components/MobileBottomSheet.test.tsx apps/web/src/components/PinnedPanel.tsx apps/web/src/components/PinnedField.tsx apps/web/src/index.css
git commit -m "feat(web): add persistent mobile data sheet"
```

### Task 4: Integrate M2 responsive conversation behavior

**Files:**
- Modify: `apps/web/src/screens/Conversation.tsx`
- Modify: `apps/web/src/components/AssistantAnswer.tsx`
- Modify: `apps/web/src/components/MetricCard.tsx`

- [x] **Step 1: Enable the callback-forwarding test already written in Task 3**

Keep the second `MobileBottomSheet.test.tsx` case unchanged while wiring the real conversation props. It is the regression guard for sharing behavior rather than creating mobile-only state.

- [x] **Step 2: Run the focused test and verify the new callback assertion fails until integration props are complete**

Run: `pnpm --filter @chat/web test -- MobileBottomSheet.test.tsx`

Expected: FAIL if any shared panel handler or dirty state is not forwarded.

- [x] **Step 3: Integrate the mobile sheet into `Conversation`**

Import `MobileBottomSheet`. Keep the desktop `PinnedPanel` call and add `mode="desktop"`. Render `MobileBottomSheet` after the mobile composer, passing the same props and handlers:

```tsx
<MobileBottomSheet
  fields={Object.values(state.fields)}
  proposals={state.proposals}
  changes={state.changes}
  savedScenarios={state.savedScenarios}
  dirtyKeys={selectDirtyKeys(state)}
  busy={busy}
  onEdit={onEdit}
  onAcceptProposal={onAcceptProposal}
  onRejectProposal={onRejectProposal}
  onDeleteScenario={deleteScenario}
  onRecalculate={onRecalculate}
  onRevertChange={onRevertChange}
  onDismissChanges={onDismissChanges}
/>
```

Change transcript padding to `px-5 pt-2 md:px-14 md:pt-8`, message gap to `gap-[18px] md:gap-[26px]`, and composer padding to `px-5 pb-0 pt-3 md:px-14 md:pb-6 md:pt-5`. Ensure the sheet remains a flex-none sibling so collapsed M2 never covers the composer.

- [x] **Step 4: Make metrics and follow-ups horizontally scrollable on mobile**

In `AssistantAnswer.tsx`:

```tsx
<div className="ch-scrollbar-none -mr-5 flex gap-[9px] overflow-x-auto pr-10 md:mr-0 md:grid md:grid-cols-3 md:gap-3 md:overflow-visible md:pr-0">
  {envelope.metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
</div>

<div className="ch-scrollbar-none -mr-5 flex gap-2 overflow-x-auto pr-10 md:mr-0 md:flex-wrap md:gap-[9px] md:overflow-visible md:pr-0">
  {envelope.followUps.map((followUp) => (
    <Pill key={followUp} onClick={() => onFollowUp(followUp)} className="flex-none text-[12.5px]" disabled={disabled}>
      {followUp}
    </Pill>
  ))}
</div>
```

Use mobile typography from M2 for the attribution (`11.5px`), verdict (`17px`), and prose (`13.5px`), retaining existing sizes at `md`.

In `MetricCard.tsx`, use `w-[150px] flex-none px-[15px] py-[14px] md:w-auto md:min-w-0 md:px-5 md:py-[18px]`, `text-[23px] md:text-[28px]` for the value, and mobile labels/context matching the artboard.

- [x] **Step 5: Run the focused tests and typecheck**

Run:

```bash
pnpm --filter @chat/web test
pnpm --filter @chat/web typecheck
```

Expected: all tests pass and TypeScript reports no errors.

- [x] **Step 6: Commit M2 integration**

```bash
git add apps/web/src/screens/Conversation.tsx apps/web/src/components/AssistantAnswer.tsx apps/web/src/components/MetricCard.tsx apps/web/src/components/MobileBottomSheet.test.tsx
git commit -m "feat(web): integrate phase 4 mobile conversation"
```

### Task 5: Verify M1–M3 and desktop regression

**Files:**
- Create: `design-qa.md`
- Modify only files with verified P0–P2 fidelity defects found during QA.

- [x] **Step 1: Run the complete automated verification suite**

Run:

```bash
pnpm test
pnpm typecheck
pnpm --filter @chat/web build
```

Expected: all tests pass, all packages typecheck, and Vite produces `apps/web/dist`.

- [x] **Step 2: Start the local app without changing its runtime configuration**

Run: `pnpm --filter @chat/web dev -- --host 127.0.0.1`

Expected: Vite serves the app at `http://127.0.0.1:5173/` and remains running.

- [x] **Step 3: Compare M1 at 390 × 844**

Open the supplied `Chat IA - Errores y Mobile.dc.html` and the local app in the same browser. At 390 × 844 verify:

- compact nav and avatar;
- 27px headline and mobile “abajo” copy;
- exactly three 45px starter rows;
- composer above the persistent empty summary;
- no desktop side panel or horizontal page overflow.

- [x] **Step 4: Compare M2 and M3 at 390 × 844**

Use an existing persisted conversation or send the reference property prompt. Verify:

- metrics and follow-ups scroll horizontally with a partial next item;
- collapsed sheet shows dynamic fixed/assumed/scenario counts and does not cover the composer;
- tap and upward drag open the sheet;
- expanded sheet is 88dvh with scrim, 16px top corners, fixed header/footer, 50px CTA, and independently scrollable fields;
- field editing, proposals, scenario deletion/undo, dirty band, and recalculate still call existing behavior;
- scrim, downward drag, and Escape close it.

- [x] **Step 5: Check desktop regression (completed at 1280 × 720)**

Verify the 372px right panel, 60px nav, transcript width, metric grid, composer, and empty state are visually unchanged.

- [x] **Step 6: Record and resolve design QA**

Create `design-qa.md` with:

```markdown
# Phase 4 Design QA

Reference: `Chat IA - Errores y Mobile.dc.html`, M1–M3  
Prototype: `http://127.0.0.1:5173/`

## M1 — 390 × 844
- Result: passed

## M2 — 390 × 844
- Result: passed

## M3 — 390 × 844
- Result: passed

## Desktop regression — 1440 × 900
- Result: passed

## Remaining P3 notes
- None.

final result: passed
```

If comparison finds P0–P2 defects, list each with viewport and evidence, fix only those defects, recapture, and repeat the affected section. Do not mark the final result passed before all P0–P2 items are closed.

- [x] **Step 7: Re-run verification after QA fixes**

Run:

```bash
pnpm test
pnpm typecheck
pnpm --filter @chat/web build
git diff --check
```

Expected: all checks pass and `design-qa.md` says `final result: passed`.

- [x] **Step 8: Commit final QA**

```bash
git add apps/web design-qa.md pnpm-lock.yaml
git commit -m "test(web): verify phase 4 mobile fidelity"
```
