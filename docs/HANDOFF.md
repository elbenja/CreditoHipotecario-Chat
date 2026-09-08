# Handoff — Phase 4 implemented, UX review in progress

Written 2026-09-07 after deployment and updated 2026-09-08 after the Phase 4
merge. Start here in a new chat.

## Where things stand

Phases 1–4 are built. The pre-Phase 4 POC was **deployed and verified live**.
Phase 4 passed local automated and visual QA and is merged to `main`; its live
mobile deployment still needs a recorded verification pass.

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
