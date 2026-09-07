import { callKimi } from './kimi.ts';
import { buildServer } from './routes/chat.ts';

// Hosts inject PORT; API_PORT stays the local default.
const port = Number(process.env.PORT ?? process.env.API_PORT ?? 8787);
// 0.0.0.0 so the platform's router can reach us; 127.0.0.1 only accepts local.
const host = process.env.HOST ?? '0.0.0.0';
const app = buildServer({ callModel: callKimi });

await app.listen({ port, host });
console.log(`api listening on http://${host}:${port}`);
