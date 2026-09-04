# Chat IA + Datos fijados — POC design

**Date:** 2026-09-04
**Status:** approved for planning
**Source design:** Claude Design project `ad381f94-1bb3-43a6-8b2a-c4902d398510`, handoff at `design_handoff_chat_ia/README.md`

## 1. What this is

A conversational interface for CréditoHipotecar.io. The user describes a property in prose; Kimi 2.6 (Moonshot) answers with a financial analysis. The distinguishing feature is not the chat — it is the **right-hand panel**: every fact the model extracts or assumes is pinned there as an editable field with visible provenance, and every "cause → effect" insight can be saved as a scenario card.

### What this POC is for

**Proving the UX, not the arithmetic.** The open question is whether the pin-and-edit panel, the provenance dots, and the scenario cards actually work as an interaction model. Numeric exactness is explicitly *not* being tested here — see §2.

Standalone repo, to be integrated into `credito-hipotecario` later.

### Three principles inherited from the design handoff

1. **Every pinned datum carries provenance.** "Lo dijiste tú" (slate dot) vs "Lo asumí yo" (`#F4BC44` dot). An assumed 10% down payment presented as fact is a bug, not a detail.
2. **Numbers leave the prose.** Verdict headline + 3 metric cards + max 3 short paragraphs. Never dump the raw model paragraph.
3. **Editing a field does not rewrite history.** Editing marks the panel dirty and offers *Recalcular*, which **appends** a new assistant message. The transcript stays auditable.

## 2. Numbers in the POC: Kimi computes, UI declares it

**Decision: the deterministic engine is not wired in this POC.** Kimi produces every number — cuota, yield, cash flow, scenario deltas, rent. No `compute_mortgage` tool, no vendored calculation package.

The consequence must be visible rather than hidden: every figure the POC displays is **indicative**, and the UI says so (§8). This is a demo of an interaction model, not a calculator.

### Why this is safe here and would not be in production

The handoff's own numbers were authored against the real EAR formula. Verified 2026-09-04 against `credito-hipotecario/src/utils/calculations/mortgage/loan.ts`:

| Design states | Real formula gives | Match |
| --- | --- | --- |
| cuota `S/ 1,843` | `1,843.09` | exact |
| 30% inicial → `S/ 1,434` | `1,433.51` | exact |
| 25 años → `S/ 1,695` | `1,695.18` | exact |
| plazo delta `−S/ 148` | `−148` | exact |
| ingreso neto `↓ S/ 443` | `−443` | exact |
| efectivo para 30% `S/ 75,000` | `75,000` | exact |
| yield bruto `8.4%` | `8.40%` | exact |
| tasa 7.24% → `−S/ 90` | `−97` | off by 7 |

**These eight rows are the acceptance criteria for the follow-up work in §4.** When the engine is wired, it must reproduce them. Recorded here so that verification does not have to be re-derived later.

### Follow-up trigger, to be stated explicitly at demo time

> The numbers are indicative. Once the UX is proven, the next step is wiring the panel to the existing deterministic engine so the chat and the portfolio simulator can never disagree.

## 3. Repository layout

```
CreditoHipotecario-Chat/
├─ packages/
│  └─ shared/        zod schemas + shared TS types
└─ apps/
   ├─ api/           Node/TS service; holds MOONSHOT_API_KEY; calls Kimi
   └─ web/           Vite + React + TS + Tailwind
```

`packages/calc` is deliberately absent — see §4.

### Deviation from the handoff, accepted deliberately

The handoff assumes building inside `credito-hipotecario` and reusing its `Button`/`Card`/`Input` shadcn primitives and Supabase. This POC is standalone. Consequences, accepted:

- Design tokens are **vendored** into a Tailwind theme rather than resolved from the app's shadcn config.
- Components are written directly; no shadcn dependency.
- **No Supabase.** "Guardar como propiedad" is stubbed (§9).

When integrating later, the token layer is the seam: swap the vendored theme for the app's shadcn tokens and the components should resolve to the same values.

## 4. Deferred: wiring the deterministic engine

Not built in this POC. Recorded so the follow-up does not start from zero.

**Source:** `credito-hipotecario/src/utils/calculations/mortgage/` — `goalSeek.ts`, `scenarioCalculator.ts`, `fixedPayments.ts`, `breakEvenPoint.ts`, and the pure parts of `loan.ts` (`calculateMonthlyPayment`, `calculateLoanAmountSync`). Everything Supabase-coupled (`calculateLoanAmount`, `getPropertyBonus`) is excluded, as are the dated backup files littering that tree.

**Three conventions a naive reimplementation gets wrong:**

1. **Monthly rate is EAR-derived:** `Math.pow(1 + annualRate/100, 1/12) - 1`. **Not** `annualRate/12`. This is the Peruvian TEA convention.
2. **`installments_per_year` may be 14**, with double payments in July and December. That case has no closed form — `goalSeek` binary-searches the installment so the balance lands at zero.
3. Currency is **PEN / USD**, not CLP/UF. The source carries a hardcoded `exchangeRate = 3.7167`.

**Shape of the eventual change:** a post-processing step in the API that recomputes engine-owned values and substitutes them into the envelope, discarding whatever Kimi returned. Engine-owned = cuota, loanAmount, yield, net income, and the `tasa`/`inicial`/`plazo` scenario deltas — each of which is `calculateMonthlyPayment` with one input varied. Model-owned stays: rent estimate, `amoblado` scenario, verdict, prose, notes, followUps.

**Acceptance:** the eight rows in §2.

## 5. `packages/shared` — the envelope contract

```ts
type Provenance = 'user' | 'assumed' | 'market';

interface PinnedField {
  key: 'ubicacion'|'precio'|'area'|'tasa'|'inicial'|'plazo'|'alquiler';
  label: string;
  value: string;          // kept as string; format on blur, not per keystroke
  prefix?: string;        // 'S/'
  suffix?: string;        // '%' | 'm²' | '/mes' | 'años'
  provenance: Provenance;
  note: string;
}

interface Scenario {
  id: string;
  cause: string;          // 'Si lo amueblas'
  value: string;          // '+S/ 250' — pre-formatted, signed
  unit: string;           // '/mes de alquiler'
  tone: 'good'|'tradeoff'|'bad';
  note: string;           // MUST carry a range, a caveat, or the cash cost
}

interface AnalysisEnvelope {
  verdict: string;
  fields: PinnedField[];
  metrics: { label: string; value: string; delta: string|null; context: string }[];
  scenarios: Scenario[];
  sources: string[];
  prose: string[];        // max 3
  followUps: string[];    // max 3
}
```

Expressed as zod schemas in `shared`, imported by both `api` (validation) and `web` (types).

No `estimated` flag: in this POC *every* number is model-estimated, so a per-metric marker would be noise. The declaration is global instead (§8).

## 6. `apps/api` — the Kimi call

`POST /api/chat`, Server-Sent Events. Request carries `{ messages, fields, savedScenarios }`.

Events emitted: `status` (drives states 02/03), `analyzeStep`, `envelope`, `error`.

**No tools.** Kimi answers directly with the envelope. Tool-calling arrives with the engine (§4).

### Post-processing pipeline

Runs after Kimi's final message, in order:

1. **Parse + zod-validate** the envelope. On failure → step 5.
2. **Enforce provenance.** Any field value not literally present in a user turn is forced to `assumed`, regardless of what the model claimed. Per the handoff: enforce server-side. This is the one guarantee the POC *does* make, and it is the one the design cares most about.
3. **Cap** `prose` at 3 and `followUps` at 3. Truncate silently — the cards carry the numbers.
4. **Format** all numerics to Peruvian convention: `S/ 1,750` — space after `S/`, comma thousands, no "mil"/"M". Reject and re-format rather than passing model formatting through.
5. **E4 fallback:** on validation failure, emit the prose unchanged, skip the panel update, run regex extraction over the prose for candidate values, and emit them as manual-pin chips.

Step 5 is why the validator is built in Phase 1 rather than deferred with the other error states. E4 is not an edge case — it is the contract's failure mode, and the design treats it as a first-class state.

### System prompt requirements

- Role, Peruvian market context, PEN currency, Spanish (Peru register).
- The envelope contract, with the JSON schema.
- Provenance rules — do not claim `user` for anything inferred.
- **Scope boundary** driving E5: mortgages and property in Peru only; refuse in one line plus two in-scope redirects.
- Scenario note rule: every note carries a range, a caveat, or the cash cost. Never a bare precise figure.
- Instruct the model to use the standard Peruvian TEA convention (effective annual → monthly) so its figures land near the eventual engine's, reducing visible drift at wiring time.

### Secrets

`MOONSHOT_API_KEY` lives in `apps/api` env only. Never reaches the browser. `.env` is gitignored; `.env.example` is committed.

## 7. `apps/web` — state

The handoff's shape, used as-is:

```ts
interface ChatState {
  messages: Message[];              // user | assistant, append-only
  fields: Record<string, PinnedField>;
  baseline: Record<string, string>; // values at last recalculation
  savedScenarios: string[];         // Scenario ids, ordered
  status: 'idle'|'sending'|'thinking'|'analyzing'|'streaming'|'error';
  analyzeSteps: { label: string; done: boolean }[];
}
```

`dirty` is **derived, never stored**: `Object.keys(fields).filter(k => fields[k].value !== baseline[k])`. Recalculating sets `baseline = current values`.

`messages` is append-only. *Recalcular* appends; it never mutates a rendered answer.

Implemented as a reducer. No state library for the POC.

### Value-change arbitration — added to the design

The handoff guards one direction only. When the **user** edits a field, the panel goes dirty and demands an explicit *Recalcular*. When the **model** changes a field, the envelope overwrites it silently and the user is never told. The risk sits in the unguarded direction.

Four tiers, decided by who owns the value:

| Change | Treatment |
| --- | --- |
| Empty → value | **Silent.** This is the core loop working; announcing it would be noise. |
| Model revises its own earlier assumption | **Announce**, revertible. |
| Model revises a value the user stated in chat | **Announce**, revertible. |
| Model overwrites a value the user typed in the panel | **Blocked.** The human value stands; the model's becomes a visible proposal. |

Announcements are non-blocking, following the design's own instincts — E4 degrades rather than erroring, and micro-interaction 08 rejects confirmation dialogs for anything reversible. The answer renders and the numbers move; a compact changes strip says what moved, with revert.

The fourth tier is the one that matters. A user who typed `30` into *cuota inicial* has made a decision. A model that quietly resets it to `10` and then reports that the deal does not work has reversed a human choice and given advice premised on its own reversal. So a hand-edited field is locked: the model may propose, the panel keeps the user's value, and the conflict stays visible until the user accepts or rejects it. Accepting one proposal does not unlock the field — it stays the user's.

**State additions:** `userEdited: string[]` (keys the user has typed into), `changes: FieldChange[]`, `proposals: Record<string, PinnedField>`. `FieldChange = { key, label, from, to }`. All serialisable, so `localStorage` persistence still round-trips.

`baseline` is derived from the post-arbitration field values, so a blocked field does not spuriously mark the panel dirty.

Scope: reducer arbitration in Phase 1 (it is where the silent overwrite lives); the changes strip and conflict UI in Phase 2.

### Saving a scenario is staging, not persistence

Two distinct acts, often conflated:

| Action | Effect |
| --- | --- |
| "Guardar" on a scenario card | Pushes the id into `savedScenarios` in React state. **Nothing else.** |
| "Guardar como propiedad" (panel footer) | Writes pinned fields **and** saved scenarios to Supabase as one property record |

The design's empty-state copy states the model: *"Se van con la propiedad cuando la guardes."* A saved scenario is staged, then promoted by the property save. In this POC the property save is stubbed (§9), so **no scenario ever reaches a database.**

### Draft persistence — added to the design

The design has no state between "in memory" and "saved as a property", and the nav pill advertises this as *"sin guardar"*. A user who pins seven fields over ten turns and saves three scenarios loses all of it to a tab reload.

Mitigation: mirror `ChatState` into `localStorage` on every mutation, restore on load, clear on successful property save. No backend and no schema required. This makes "sin guardar" mean *not yet in your portfolio* rather than *one keystroke from gone*.

Scope: Phase 2, alongside scenario save/delete.

## 8. Design tokens and the "indicative numbers" treatment

Tokens vendored into the Tailwind theme. Full table in the handoff; the rules that constrain implementation:

- **Palette:** Tailwind slate + exactly one accent, `#F4BC44`. App background `#0b0f1a`.
- **Accent discipline:** on Screen 2, `#F4BC44` appears in exactly four places — nav underline, the "Lo asumí yo" legend and dots, the trade-off scenario value, the dirty band. A fifth dilutes all of them.
- **Contrast:** `#475569` is decorative only — it fails AA on `#0f172a` and `#1e293b`. Secondary text is `#94a3b8`. Micro-labels at `#64748b` only on `#0b0f1a`/`#0f172a`; on `#1e293b` cards they must be `#94a3b8` at 11px.
- **Type:** Plus Jakarta Sans (800 headlines / 700 values) + Inter (everything else). All numerics `font-variant-numeric: tabular-nums`.
- **Motion:** easing `cubic-bezier(.2,.7,.2,1)`, durations 120/180/240ms. No bounce, no spring, no `transform: scale()` on hover.
- **Layout:** panel 372px fixed, transcript 640px max, top nav 60px.
- **Icons:** HugeIcons Stroke Rounded via CDN. **Fonts:** Google Fonts.

### The indicative-numbers marker

Because §2 makes every figure model-produced, the POC must say so once, clearly, without turning into a disclaimer-covered mess:

- A persistent marker in the top nav, beside the context pill: **"números indicativos · POC"**.
- Styled as the existing nav pill (11.5px `#94a3b8`, `#1e293b` border) — **not** in `#F4BC44`, which would break the four-place accent discipline above.
- Stated once globally. Individual metric cards stay clean.

Source pills (`babilonia.pe` · `Adondevivir` · `BCRP`) render when Kimi supplies them. They are model-claimed references, not verified lookups — the global marker is what keeps that honest for the POC. See §9.

The `.dc.html` files use a design-tool-only streaming runtime (`support.js`). **That runtime is not ported.** The `.dc.html` files are opened in a browser as visual reference during implementation.

## 9. Known POC limitations — deliberate

1. **All numbers are model-produced and indicative.** §2. The single largest gap, marked in the UI, with the follow-up specified in §4.
2. **Rent is model-estimated.** No estimation engine exists in `credito-backend`, `credito-hipotecario`, `hipotecar-io`, or `CrHi_AI`; `valorizacion.py` stores valuations, it does not compute them. Renders with the yellow `assumed` dot. Approach to be discussed with the dev after the demo.
3. **Source pills are model-claimed, not verified lookups.** Kimi supplied them in testing, so they render. *Flagged: presenting unverified references as sourced fact in a tool used for a S/ 250,000 decision is a real risk. Revisit before this leaves POC status.*
4. **No database.** "Guardar como propiedad" is stubbed. Pinned fields and saved scenarios live in React state, mirrored to `localStorage` (§7). Nothing is written server-side.

## 10. Phasing

| Phase | Contents |
| --- | --- |
| **1 — spine** | `shared` schemas · `api` + real Kimi + post-processing pipeline incl. the E4 validator · desktop Screens 1–2 · micro-interactions 01–05 · the indicative-numbers marker |
| **2 — the feature** | scenario save/delete · dirty band · *Recalcular* · changes strip and conflict UI · `localStorage` draft persistence · micro-interactions 06–08 |
| **3 — robustness** | E1–E5 |
| **4 — mobile** | M1–M3 persistent bottom sheet |

Phase 1 exists to answer the only real unknown: **does Kimi 2.6 hold the envelope contract?** Everything else is known-quantity UI work.

## 11. Testing

Scoped to what the POC actually guarantees. No calculation tests — there is no calculation code (§2).

- **envelope validation:** a valid envelope passes; malformed JSON routes to E4 with regex candidates; over-length `prose`/`followUps` truncate to 3.
- **provenance enforcement:** a model-claimed `user` provenance on a value absent from user turns is forced to `assumed`.
- **formatting:** `1750` → `S/ 1,750`; rejects `S/1,750` and `1.75 mil`.
- **state:** `dirty` derives correctly; *Recalcular* appends rather than mutates; `localStorage` round-trips `ChatState`.
- **value-change arbitration:** filling an empty field is silent; revising a model assumption records a change; overwriting a user-typed field is blocked and becomes a proposal; accepting a proposal does not unlock the field.
