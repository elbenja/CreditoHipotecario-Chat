import { PinnedFieldSchema } from '@chat/shared';
import Fastify, { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ModelReply } from '../kimi.ts';
import { runPipeline } from '../pipeline/index.ts';
import { REFUSAL_ENVELOPE, isOutOfScope } from '../pipeline/scope.ts';
import { buildMessages, type ChatMessage } from '../prompt.ts';

const BodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() }))
    .min(1),
  fields: z.array(PinnedFieldSchema).default([]),
});

export interface ServerDeps {
  callModel: (messages: ChatMessage[]) => Promise<ModelReply>;
}

/** Steps shown while waiting. Real labels — this is where trust is built. */
const ANALYZE_STEPS = [
  'Leyendo lo que me contaste',
  'Contrastando precio por m² del distrito',
  'Calculando cuota y flujo mensual',
];

export function buildServer(deps: ServerDeps): FastifyInstance {
  const app = Fastify({ logger: false });

  app.post('/api/chat', async (request, reply) => {
    const parsed = BodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid request body' });
    }
    const { messages, fields } = parsed.data;

    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const send = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    send('status', { phase: 'thinking' });

    // Guardrail: refuse off-topic turns before spending a model call.
    // Only the latest user turn is checked — earlier context is already scoped.
    const latest = messages.filter((m) => m.role === 'user').at(-1);
    if (latest && isOutOfScope(latest.content)) {
      send('status', { phase: 'streaming' });
      send('envelope', { envelope: REFUSAL_ENVELOPE, truncated: false, outOfScope: true });
      reply.raw.end();
      return;
    }

    for (const label of ANALYZE_STEPS) send('analyzeStep', { label });
    send('status', { phase: 'analyzing' });

    try {
      const { content, truncated } = await deps.callModel(buildMessages(messages, fields));
      const userTurns = messages.filter((m) => m.role === 'user').map((m) => m.content);
      const result = runPipeline(content, userTurns);

      send('status', { phase: 'streaming' });
      if (result.ok) {
        send('envelope', { envelope: result.envelope, truncated });
      } else {
        send('fallback', { prose: result.prose, candidates: result.candidates, truncated });
      }
    } catch (err) {
      // Log the real error; the user gets Spanish, not an SDK string.
      console.error('[chat] model call failed:', err);
      send('error', { kind: 'api', message: 'Se cayó la conexión con el modelo. Tus datos siguen acá.' });
    } finally {
      reply.raw.end();
    }
  });

  return app;
}
