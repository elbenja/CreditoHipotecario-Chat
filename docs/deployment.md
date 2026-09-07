# Deployment — web on Vercel, API on a Node host

**Date:** 2026-09-07
**Status:** code on `feat/deploy-api`, not yet merged; hosting steps pending operator action
**Branch of record:** `feat/deploy-api` (commits `9e7d19a`, `3710555`)

## 1. What this is

The POC deploys as **two services, not one**. `apps/web` is a static Vite bundle
on Vercel. `apps/api` is a long-lived Fastify process on a Node host. This
document explains why that split is forced, what changed in the code to support
it, and how to deploy each side.

The trigger was a `404: NOT_FOUND` on the first Vercel deploy. Two separate
causes, both now fixed in code:

1. `main` held only docs — the app lived on unmerged feature branches, so Vercel
   built an empty repo.
2. Nothing served `/api/chat` in production, so even a correct web build had no
   backend to talk to.

## 2. Why the API cannot be folded into the web deploy

**`MOONSHOT_API_KEY` must never reach the browser.** Anything the browser can
read, any visitor can read — view-source is enough. The key therefore requires a
server-side process that holds it and proxies calls to Moonshot. That process is
`apps/api`, and it is the only reason the API tier exists.

A related trap: Vite inlines every `VITE_*` variable into the client bundle at
build time. Naming the key `VITE_MOONSHOT_API_KEY` would publish it as plain
text in a public JS file. This is tempting when `/api` calls fail in production
and it must never be done. `VITE_API_URL` is safe precisely because a public URL
is not a secret.

**There is only ever one Moonshot key.** A second key for the web tier is not
needed and would not help — the problem was never the key, it was the absence of
a server to use it.

### Why not Vercel serverless functions

`apps/api/src/routes/chat.ts` streams SSE via `reply.hijack()` and raw writes to
keep the analyze-steps and token stream flowing. That is a persistent-connection
pattern; it fights the serverless request/response model. Restructuring it into
Vercel functions was considered and rejected as the larger change for the same
result. A persistent Node host runs the existing code nearly as-is.

The cost of that choice is CORS, since the two tiers now sit on different
origins. Section 4 covers it.

## 3. What changed in the code

| Change | File | Why |
|---|---|---|
| Bind `0.0.0.0`, honour `PORT` | `apps/api/src/index.ts` | `127.0.0.1` accepts only local connections, so the platform router could never reach it. Hosts inject `PORT`; `API_PORT` stays the local default. |
| CORS headers + `OPTIONS` preflight | `apps/api/src/routes/chat.ts` | Web and API are cross-origin in production. Written on the raw response because Fastify's `onSend` hooks **do not run for hijacked replies**. |
| `VITE_API_URL` base for the fetch | `apps/web/src/api/streamChat.ts` | The hardcoded `/api/chat` only worked via the dev-server proxy. Empty in dev, so local behaviour is unchanged. |
| `start` script + `engines.node >=22.6` | `apps/api/package.json` | `dev` runs with `--watch`; a host had no production entrypoint. `--experimental-strip-types` needs Node 22.6+. |
| `vercel.json` | repo root | The root `package.json` has no `build` script, so Vercel could not infer the monorepo build. Also adds the SPA rewrite. |
| `vite-env.d.ts` | `apps/web/src/` | `import.meta.env` needs Vite's client types or `tsc --noEmit` fails. |

### Vercel build settings

These live in `vercel.json` and should not be duplicated in the dashboard:

```json
{
  "buildCommand": "pnpm --filter @chat/web build",
  "outputDirectory": "apps/web/dist",
  "installCommand": "pnpm install",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

**Root Directory must stay at the repo root.** `@chat/web` depends on
`@chat/shared` via `workspace:*`, so the install needs to see
`pnpm-workspace.yaml`. Pointing Vercel at `apps/web` breaks the install.

The rewrite is what stops client-side routes from 404ing — a real 404, distinct
from the empty-deployment one that started this.

## 4. Environment variables — which tier owns what

The single most common mistake here is setting a variable on the wrong service.

| Variable | Lives on | Secret | Notes |
|---|---|---|---|
| `MOONSHOT_API_KEY` | **API host only** | **yes** | Useless on Vercel. Never prefix with `VITE_`. |
| `MOONSHOT_BASE_URL` | API host | no | `https://api.moonshot.ai/v1` |
| `MOONSHOT_MODEL` | API host | no | `kimi-k2.7-code-highspeed` |
| `WEB_ORIGIN` | API host | no | CORS allowlist. Must match the Vercel domain exactly — scheme included, no trailing slash. Defaults to `*` if unset. |
| `PORT` | injected by host | no | Do not set manually. |
| `API_PORT` | local only | no | Local default when `PORT` is absent. |
| `VITE_API_URL` | **Vercel only** | no | Origin of the deployed API. Empty in dev. |

**The local `.env` never reaches either host.** It is gitignored (correctly —
verified never committed on any branch), so it is not in the push. Local and
deployed configuration are separate stores and must both be maintained.

**`VITE_API_URL` is consumed at build time, not runtime.** It must be set on
Vercel *before* the build that ships it; adding it afterwards requires a
redeploy to take effect.

## 5. Deployment runbook

Order matters — step 3 must precede step 4.

**1. API host** (Render/Railway/Fly). Connect the repo, then:

| Setting | Value |
|---|---|
| Root Directory | *(blank — the pnpm workspace needs the repo root)* |
| Build Command | `pnpm install` |
| Start Command | `pnpm --filter @chat/api start` |

**2. Set the API env vars** from the table in §4. The operator enters
`MOONSHOT_API_KEY` directly into the host's own settings UI — it should not be
pasted into chat transcripts, shell history, or CI logs.

**3. Set `VITE_API_URL` on Vercel** to the URL the API host returned.

**4. Merge to `main`.** This triggers the production build, which bakes in the
value from step 3.

**5. Set `WEB_ORIGIN`** on the API host to the live Vercel domain, tightening
CORS off the `*` default.

## 6. Local development is unchanged

`pnpm dev` still works exactly as before. `VITE_API_URL` is empty locally, so
`streamChat` requests the relative `/api/chat` and Vite's proxy forwards it to
`127.0.0.1:8787`. The API reads the repo-root `.env` through `apps/api/src/env.ts`
regardless of cwd. No developer needs to set anything new.

## 7. Verified

- 166 tests pass — 105 `apps/api`, 61 `apps/web`
- `tsc --noEmit` clean across all three packages
- `pnpm --filter @chat/web build` succeeds, output in `apps/web/dist`
- Server boots on `0.0.0.0`, honours `PORT`, `OPTIONS /api/chat` returns `204`
  with the expected `Access-Control-*` headers
- No key material in the built bundle; `apps/web/dist` is gitignored

## 8. Known gaps

- **Not exercised against the real Moonshot API.** Every check above used a
  dummy key. The first live deploy is the first real test of that path.
- **Free-tier cold starts.** Render's free tier sleeps when idle; the first
  request then takes roughly 30s. That is particularly visible with streaming,
  where the UI shows analyze-steps while waiting. Consider a paid tier or a
  keep-alive ping before any demo.
- **`WEB_ORIGIN` defaults to `*`.** Convenient for first deploy, too permissive
  to leave in place. Step 5 exists to close it.
- **No healthcheck endpoint.** Hosts that probe for one have nothing to hit.
- **`apps/api` has no deploy config in-repo** (no `render.yaml`). Settings live
  in the host dashboard, so they are not version-controlled.
