# Deploy

The API and the web app deploy separately: the API runs as a long-lived Node
service (Railway / Render / Fly), and the web app stays a static Vercel
build that talks to it over HTTP.

## API — Railway / Render / Fly

It's a normal Node service, no platform-specific adapter needed.

- **Root**: the repo root (it's a pnpm workspace).
- **Install**: `pnpm install`
- **Start**: `pnpm --filter @chat/api start`
- **Node**: >= 22.6 (the start script uses `--experimental-strip-types`).

Environment variables:

- `MOONSHOT_API_KEY` — required.
- `PORT` — injected by the host; the server also honours `API_PORT` locally.
- `MOONSHOT_MODEL=kimi-k2.7-code-highspeed`
- `MOONSHOT_BASE_URL=https://api.moonshot.ai/v1`
- `CORS_ORIGIN` — set to the Vercel URL once it's known (comma-separated for
  more than one origin). Left unset, CORS is wide open, matching this
  deployment's deliberate choice to be public.
- `DEMO_TURNS` (default 12), `DEMO_DAILY_TURNS` (default 150),
  `DEMO_SESSIONS_PER_IP` (default 3) — see "Public demo" below.

### Public demo

`POST /api/demo` hands out a password-free demo token so a reviewer can try
the chat. Each token gets `DEMO_TURNS` text turns (no documents or listings),
all demo tokens together share `DEMO_DAILY_TURNS` per UTC day, and one client
IP can mint `DEMO_SESSIONS_PER_IP` tokens per day. `DEMO_TURNS=0` turns the
demo off. The counters live in memory: a restart resets them, and they
assume a single instance — scaling out multiplies the caps.

A `render.yaml` blueprint for one-click Render deploys lives at
`apps/api/render.yaml`. For Railway, `railway.json` at the repo root sets the
same build and start commands; also set `NIXPACKS_NODE_VERSION=22` on the
service, because Nixpacks does not reliably resolve the `>=22.6` range in
`engines` and silently falling back to an older Node breaks
`--experimental-strip-types`.

## Web — Vercel

- **Root Directory**: the repo root (not `apps/web`).
- **Include files outside the Root Directory in the Build Step**: must be
  **enabled**. Without it, a pnpm workspace build fails with a confusing
  "module not found" error, because Vercel would otherwise only upload
  `apps/web`.
- `VITE_API_URL` — the API's public origin (no trailing slash), e.g.
  `https://creditohipotecario-chat-api.onrender.com`. Vite inlines `VITE_*`
  variables at **build** time, so changing this value requires a redeploy,
  not just a restart.
- `VITE_GOATCOUNTER_URL` — optional. The GoatCounter count endpoint, e.g.
  `https://MYCODE.goatcounter.com/count`. Unset, no analytics are sent. Only
  the events `chat-opened` and `chat-first-question` are sent; there are no
  page views. Build-time, like `VITE_API_URL`.

## Deploy order

1. Deploy the API first and get its public URL.
2. Set `VITE_API_URL` on Vercel to that URL, then redeploy the web app.
3. Set `CORS_ORIGIN` on the API to the Vercel URL.

## Security note

This deployment is **public and unauthenticated**. Every reply to
`/api/chat` spends the Moonshot API key. Set a spend cap in the Moonshot
console before deploying, and take the deployment down after testing.

## Local development

Unchanged:

```
pnpm dev
```

The Vite dev server proxies `/api` to the local Fastify server, so
`VITE_API_URL` is not needed locally.
