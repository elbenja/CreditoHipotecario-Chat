# Handoff — deployment done, Phase 4 next

Written 2026-09-07, at the end of the deploy session. Start here in a new chat.

## Where things stand

Phases 1–3 are built. The POC is **deployed and verified live**.

| | URL |
| --- | --- |
| Web (Vercel) | https://credito-hipotecario-chat.vercel.app |
| API (Railway, project `Credito-Chat-API`) | https://credito-chat-api-production.up.railway.app |

`main` is at `3278de7`. Working tree clean, 221 tests passing, typecheck clean,
web build clean.

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

## Phase 4 — mobile bottom sheet

Spec: `docs/superpowers/specs/2026-09-04-chat-ia-datos-fijados-design.md` §10
lists Phase 4 as "M1–M3 persistent bottom sheet".

**The component is one thing — a persistent bottom sheet, the mobile
counterpart of the desktop pinned panel. But M1–M3 are three artboards, not
one idea.** The naming follows E1–E5 exactly, and each of those turned out to
be a fully specified state: exact hex values, literal copy strings, button
heights (see the Phase 3 plan, Task 3).

**Where the definitions live:** the Phase 3 plan cites its design source as
the artboards in **`Chat IA - Errores y Mobile.dc.html`**. The mobile
artboards are in that same file — it is in the filename. So M1–M3 are
specified; the file just is not in this repo.

Searched on 2026-09-07: not anywhere under the home directory, and not among
the published Claude artifacts. Most likely still in Claude Design, or on
another machine. **Open that file before planning Phase 4** — the acceptance
criteria are in it, and inventing them instead would break the pattern every
other phase followed. Phases 1–3 each have a plan in
`docs/superpowers/plans/` — follow that format.

Nothing in the deploy work touched the web UI, so Phase 4 starts from a clean
tree.

## Open items

- **Moonshot spend cap — not confirmed set.** The endpoint is public and
  unauthenticated; every reply spends the key. Decision taken: **if the tokens
  run out, put a password on the project** rather than leaving it open.
- DEPLOY.md says take the deployment down after testing. Still up.
- Railway warns `railway.json` config-as-code is deprecated in favour of
  `.railway/railway.ts`; existing files work until **2026-12-01**. Migration is
  `railway config migrate`.
- Source pills are model-claimed, not verified (spec §9.3). Flagged there as a
  real risk to revisit before this leaves POC status.
