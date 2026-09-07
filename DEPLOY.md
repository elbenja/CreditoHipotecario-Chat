# Deploy

## Vercel project settings

- **Root Directory**: the repo root (not `apps/web`).
- **Include files outside the Root Directory in the Build Step**: must be **enabled**. Without it, a pnpm workspace build fails with a confusing "module not found" error, because Vercel would otherwise only upload `apps/web`.

## Environment variables

Set these in the Vercel dashboard (Production + Preview), never committed:

- `MOONSHOT_API_KEY` — required.
- `MOONSHOT_MODEL=kimi-k2.7-code-highspeed`
- `MOONSHOT_BASE_URL=https://api.moonshot.ai/v1`

The API key must be added through the Vercel dashboard. Never commit it.

## Function duration

Hobby functions cap at 60s. A model reply takes 15-35s, so this is tight. **Enabling Fluid compute raises the cap to 300s** and is worth turning on for that headroom.

## Security note

This deployment is **public and unauthenticated**. Every reply to `/api/chat` spends the Moonshot API key. Set a spend cap in the Moonshot console before deploying, and take the deployment down after testing.

## Local development

```
pnpm dev
```
