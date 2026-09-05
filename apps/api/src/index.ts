import { callKimi } from './kimi.ts';
import { buildServer } from './routes/chat.ts';

const port = Number(process.env.API_PORT ?? 8787);
const app = buildServer({ callModel: callKimi });

await app.listen({ port, host: '127.0.0.1' });
console.log(`api listening on http://127.0.0.1:${port}`);
