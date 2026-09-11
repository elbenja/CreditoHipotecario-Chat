# Handoff — Fase B and its UX pass merged

Written 2026-09-07 after deployment, updated 2026-09-08 after the Phase 4
merge, 2026-09-11 after Fase B, and again 2026-09-11 after the UX pass on
the cronograma flow. Start here in a new chat.

## Where things stand

Phases 1–4 are built and merged to `main`. The pre-Phase 4 POC was **deployed
and verified live**; Phase 4's live mobile deployment still needs a recorded
verification pass.

**Fase B — attaching the bank's payment schedule — is merged** (PR #4,
rebase-merged 2026-09-11, `main` at `e8f10ae`). The one blocker it had — the
five real bank PDFs through the file picker with a live model call — was run
by the project owner and passed: the app reads a real cronograma end to end.
The `response_format: json_object` suspicion in `apps/api/src/kimi.ts` did
not materialise.

**The UX pass on that flow is merged** (PR #5, rebase-merged 2026-09-11,
branch `ux-composer-cronograma`), from the Claude Design page
`Micro-interacciones chat.dc.html` (cards 03, 09, 10, 11, 12, 13). 390 tests
(baseline 351), typecheck and build clean, verified in the in-app browser on
desktop and the 375px mobile preset. What it changed:

- **The bug: "Fijar estos datos" looked like a no-op.** Confirming pinned into
  `state.mortgage` fine, but the empty screen rendered `EmptyPanel`, a static
  placeholder that never reads state — and a schedule is usually uploaded
  before the first message. `EmptyState` now renders the real `PinnedPanel`
  (desktop) and `MobileBottomSheet` (mobile) the moment anything is pinned.
- **The panel has two collapsible groups, Propiedad and Hipoteca.**
  `MortgageGroup` became the generic `FieldGroup`. Both start open, always —
  the old "shut past four rows" rule hid the credit the user had just
  uploaded. The header counts both groups.
- **Cards 12/13 — the group says what changed.** The reducer keeps
  `mortgageChanges` (per key, the value the last schedule replaced, or null
  when new) and bumps `mortgageRevision` on every confirm. Open group: each
  touched row gets a 900 ms accent wash and, when it replaced something,
  "antes 8.000 % · leído del PDF" beneath. Shut group: the count crossfades
  (never counts) and a "N del PDF" pill stays on the header until the user
  opens it — nothing auto-expands. One deliberate departure from card 13:
  it keeps the dot amber "until the user confirms", but here the modal *is*
  the confirmation, so a confirmed row is green as Fase B defined it.
- **Cards 09/03 — a progress row for the attachment.** New reducer field
  `attachment: { name, size } | null` (never persisted), set by `attachStart`
  and cleared on extraction, error or cancel. `UploadingRow` shows the file,
  size and a bar while page 1 is read in the browser, then a green "Primera
  página leída" plus the server's "Extrayendo las condiciones" step spinning.
  The bar runs to 90% and lands on 100% when the server answers — there is no
  real progress to report, so none is invented. Shown in the transcript and
  under the empty screen's composer.
- **Cards 10/11 — drag and drop.** `DropZone` wraps the whole chat column on
  both screens. A dragged PDF blurs the chat behind a dashed slate-500 overlay
  ("PDF del banco · hasta 20 MB" — the app's real limits, not the card's
  "PDF o Excel · 10 MB"); a non-PDF gets the amber variant, `no-drop`, and is
  never handed up. During a drag only MIME types are known, so the extension
  in "No puedo leer .docx" comes from a MIME map; after a bad drop it comes
  from the file name and the overlay lingers 3 s.
- **One "+" control at the left of the composer**, both variants, replacing
  the link icon and the paperclip. Empty screen copy: "Sube un documento o
  pega el link de un anuncio" — pasting a listing link is planned, not built.
- **"Nueva consulta" shows after a PDF-only read.** It used to wait for a
  first message, so a session that only read a schedule had no way back.
  `App.tsx` derives the nav context from messages *or* mortgage.

**Not done:** the five real PDFs have not been dropped (as opposed to picked)
onto the deployed build. The drop goes through the same `attachSchedule`, so
this is a smoke check, not a re-verification.

## Running it locally

Both servers are needed — the web dev server proxies `/api` to port 8787:

```bash
pnpm --filter @chat/api dev   # port 8787
pnpm --filter @chat/web dev   # port 5173
```

`.claude/launch.json` has both as named configs. `bitcoin` still trips the
out-of-scope guardrail before any model call, so it is a free way to check the
whole path is wired.

The attach control is the "+" at the left of the composer, on both the empty
screen and the conversation; the whole chat column also takes a dropped PDF.
Both are disabled while a read is in flight.

| | URL |
| --- | --- |
| Web (Vercel) | https://credito-hipotecario-chat.vercel.app |
| API (Railway, project `Credito-Chat-API`) | https://credito-chat-api-production.up.railway.app |

`main` is at `e8f10ae`. The Fase B baseline is 351 tests passing, typecheck
clean, web build clean.

## What changed during the deploy

Five commits, four of them real bugs the deploy would have hit:

- `2b3abec` — **CORS headers were missing from every streamed reply.**
  `reply.hijack()` detaches the reply, so headers staged by `@fastify/cors`
  were never flushed. Invisible locally, because the Vite dev proxy makes the
  API same-origin. Has a regression test in `apps/api/src/routes/chat.test.ts`.
- `037b72c` — Render `healthCheckPath` pointed at a path that 404s; no
  `engines` at the repo root (hosts read the root `package.json`, not
  `apps/api`'s).
- `08f6a82` — added `railway.json`.
- `3278de7` — Railpack could not detect the app: the root had no `start`
  script, and `railway.json` named Nixpacks, which Railway has replaced.
  Also pinned `packageManager` to `pnpm@10.27.0` (lockfile is v9.0).

## How to check it still works — costs nothing

`bitcoin` trips the out-of-scope guardrail, which returns **before** any model
call, so this exercises the whole path for free:

```bash
curl -s -i -X POST https://credito-chat-api-production.up.railway.app/api/chat \
  -H "Origin: https://credito-hipotecario-chat.vercel.app" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"que opinas de bitcoin"}]}'
```

Expect `200`, `access-control-allow-origin` echoing the Vercel origin, and an
`outOfScope: true` envelope. A request from any other origin must come back
with **no** allow-origin header.

## Deploy gotchas that already bit once

- `VITE_API_URL` is inlined at **build** time. Changing it needs a Vercel
  rebuild with **the build cache off** — an env edit alone does nothing.
- It must include `https://`. Without the scheme the browser treats it as a
  relative path, and `vercel.json`'s SPA rewrite returns your own HTML with a
  **200**, which looks like an API fault rather than a bad URL.
- `railway up` uploads the **local working directory**. It does not pull from
  GitHub. Push ≠ deploy.
- Railway shared variables are not injected into a service until the service
  explicitly references them.

## Phase 4 — implemented, under UX review

Phase 4 delivers the supplied M1–M3 mobile states: the compact empty state,
the conversation with a persistent collapsed data summary, and the expanded
accessible bottom sheet. Desktop behavior remains intact.

- Design: `docs/superpowers/specs/2026-09-08-chat-ia-phase-4-mobile-design.md`
- Execution plan: `docs/superpowers/plans/2026-09-08-chat-ia-phase-4-mobile.md`
- Visual QA: `design-qa.md`
- Final implementation commit: `9c8a016`

The implementation phase is complete, but product review is still active.
Capture approved UX improvements in a focused follow-up plan before changing
the shipped Phase 4 behavior, then repeat the affected mobile and desktop QA.

## Open items

- **"1 datos fijados".** The mobile summary and the panel header do not
  singularise. Pre-existing; newly easy to hit now that a schedule alone can
  populate the panel.
- **Phase 4 UX review — active.** Record concrete findings, prioritize them,
  and execute only the approved improvements in a follow-up plan.
- **Phase 4 live verification — not yet recorded.** Confirm M1–M3 on the
  deployed Vercel build after the current `main` deployment completes.
- **Moonshot spend cap — not confirmed set.** The endpoint is public and
  unauthenticated; every reply spends the key. Decision taken: **if the tokens
  run out, put a password on the project** rather than leaving it open.
- DEPLOY.md says take the deployment down after testing. Still up.
- Railway warns `railway.json` config-as-code is deprecated in favour of
  `.railway/railway.ts`; existing files work until **2026-12-01**. Migration is
  `railway config migrate`.
- Source pills are model-claimed, not verified (spec §9.3). Flagged there as a
  real risk to revisit before this leaves POC status.
