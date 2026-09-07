import Fastify, { type FastifyInstance } from 'fastify';
import type { ModelReply } from '../kimi.ts';
import { parseChatBody, runTurn } from '../turn.ts';
import type { ChatMessage } from '../prompt.ts';

export interface ServerDeps {
  callModel: (messages: ChatMessage[]) => Promise<ModelReply>;
}

export function buildServer(deps: ServerDeps): FastifyInstance {
  const app = Fastify({ logger: false });

  app.post('/api/chat', async (request, reply) => {
    const body = parseChatBody(request.body);
    if (!body) {
      return reply.code(400).send({ error: 'invalid request body' });
    }

    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    try {
      for await (const { event, data } of runTurn(body, deps.callModel)) {
        reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    } finally {
      reply.raw.end();
    }
  });

  return app;
}
