import { callKimi } from './kimi.ts';
import { buildServer } from './routes/chat.ts';

// Hosts inject PORT; API_PORT stays as a local override.
const port = Number(process.env.PORT ?? process.env.API_PORT ?? 8787);
// 0.0.0.0, not 127.0.0.1: a hosted process must accept traffic from outside
// its own container, including the platform's health checks.
const host = process.env.HOST ?? '0.0.0.0';

// Fail closed: without a password the API would be open to anyone and spend
// the Moonshot key, so refuse to start instead.
const accessPassword = process.env.PASSWORD_DITO;
if (!accessPassword) throw new Error('PASSWORD_DITO is not set');

const app = buildServer({ callModel: callKimi, accessPassword });
await app.listen({ port, host });
console.log(`api listening on http://${host}:${port}`);
