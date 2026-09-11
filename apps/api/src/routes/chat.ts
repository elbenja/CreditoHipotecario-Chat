import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import type { ModelMode, ModelReply } from '../kimi.ts';
import { fetchListingText, type FetchListing } from '../listing/fetchListing.ts';
import { parseChatBody, runTurn } from '../turn.ts';
import type { ChatMessage } from '../prompt.ts';

export interface ServerDeps {
  callModel: (messages: ChatMessage[], mode: ModelMode) => Promise<ModelReply>;
  /** Injectable so tests never touch the network. */
  fetchListing?: FetchListing;
}

// The default 1 MiB bodyLimit is sized for text turns, not the image route:
// readPdf.ts renders an unreadable page 1 (scan or phone photo) at 1200px
// wide and sends it as a base64 data URL. A real scanned schedule fixture
// (apps/web/test/fixtures/scotia-page1.jpg, a genuine bank document at JPEG
// quality 80) runs ~0.245 bytes/px; a 1200px-wide render of an A4 page
// (~1200x1700) at that density is ~500 KB. Phone photos — three of five
// sample banks are scans or photos — carry noise, blur and shadow that a
// flatbed scan doesn't, so they compress worse; budgeting 3x that density
// for a bad photo gives ~1.5 MB of raw JPEG. Base64 inflates by 4/3, putting
// a realistic worst case around 2 MB. This endpoint is public and
// unauthenticated, so the limit stays close to that instead of padding it
// further — enough for a real page, not enough to invite abuse.
const CHAT_BODY_LIMIT = 3 * 1024 * 1024;

export function buildServer(deps: ServerDeps): FastifyInstance {
  const app = Fastify({ logger: false, bodyLimit: CHAT_BODY_LIMIT });

  // The web app is served from a different origin than this API.
  // CORS_ORIGIN takes a comma-separated allowlist; default open, matching
  // this deployment's deliberate choice to be public.
  const allowed = process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()).filter(Boolean);
  app.register(cors, { origin: allowed && allowed.length > 0 ? allowed : true, methods: ['POST', 'OPTIONS'] });

  app.post('/api/chat', async (request, reply) => {
    const body = parseChatBody(request.body);
    if (!body) {
      return reply.code(400).send({ error: 'invalid request body' });
    }

    reply.hijack();
    // hijack() detaches the reply, so headers staged by plugins — the CORS
    // allow-origin among them — are never flushed. Carry them onto the raw
    // response, or a cross-origin browser blocks every streamed reply.
    for (const [key, value] of Object.entries(reply.getHeaders())) {
      if (value !== undefined) reply.raw.setHeader(key, value);
    }
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    try {
      for await (const { event, data } of runTurn(body, deps.callModel, deps.fetchListing ?? fetchListingText)) {
        reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    } finally {
      reply.raw.end();
    }
  });

  return app;
}
