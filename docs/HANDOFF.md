# Handoff — Fase B built, PR #4 open, one manual check left

Written 2026-09-07 after deployment, updated 2026-09-08 after the Phase 4
merge, and updated 2026-09-11 after Fase B. Start here in a new chat.

## Where things stand

Phases 1–4 are built and merged to `main`. The pre-Phase 4 POC was **deployed
and verified live**; Phase 4's live mobile deployment still needs a recorded
verification pass.

**Fase B — attaching the bank's payment schedule — is built and open as
[PR #4](https://github.com/elbenja/CreditoHipotecario-Chat/pull/4)**, branch
`fase-b-cronograma`. 351 tests (baseline 244), typecheck and build clean.

One thing blocks the merge, and it needs a human: **run the five real bank PDFs
through the file picker end to end**, with a live model call. It could not be
automated — vite returns 403 for paths outside the workspace and that guard was
deliberately not weakened, and driving the OS file picker would have put client
PII through five live model calls. What *was* verified in a real browser, with
synthetic PDFs: the pdf.js worker resolves, text extraction and canvas render
work, all four error codes surface correctly, and the text-vs-scan threshold
routes right.

If that run fails, the first suspect is `response_format: { type: 'json_object' }`
in `apps/api/src/kimi.ts` on image turns — it was kept on a deliberate ruling
with no evidence either way, and the fix is one line.

The one spec item not built is **drag and drop**. It and eleven other known
follow-ups are in `docs/superpowers/plans/2026-09-10-fase-b-follow-ups.md`.

## Running it locally

Both servers are needed — the web dev server proxies `/api` to port 8787:

```bash
pnpm --filter @chat/api dev   # port 8787
pnpm --filter @chat/web dev   # port 5173
```

`.claude/launch.json` has both as named configs. `bitcoin` still trips the
out-of-scope guardrail before any model call, so it is a free way to check the
whole path is wired.

The attach control lives in the composer, on both the empty screen and the
conversation. It is disabled while a read is in flight.

| | URL |
| --- | --- |
| Web (Vercel) | https://credito-hipotecario-chat.vercel.app |
| API (Railway, project `Credito-Chat-API`) | https://credito-chat-api-production.up.railway.app |

`main` is at `9c8a016`. The Phase 4 verification baseline is 232 tests passing,
typecheck clean, web build clean, and `design-qa.md` marked `passed`.

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

- **Fase B manual verification — blocks PR #4.** The five real schedules
  through the file picker, scored field by field. See above.
- **Drag and drop — a decision, not a bug.** The spec asks for it; it was kept
  out of the final fix wave on purpose, because that wave carried four
  correctness fixes and the process allows only one.
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
