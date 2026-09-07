import type { IncomingMessage, ServerResponse } from 'node:http';

// A model reply takes 15-35s, so the default duration is not enough.
export const config = { maxDuration: 60 };

/**
 * Vercel's Node runtime invokes with (IncomingMessage, ServerResponse) and
 * waits for res.end(). Returning a Web-standard Response from here is ignored
 * and the request hangs until the platform times it out — no error, no output.
 * So this writes SSE to the response stream directly, exactly as the local
 * Fastify route does.
 *
 * Imports are dynamic and inside the try because a static import that throws
 * while the module graph loads kills the function before any handler exists,
 * and Vercel can then only report FUNCTION_INVOCATION_FAILED, which names
 * nothing.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }

  let stage = 'body';
  try {
    // @vercel/node parses a JSON body onto req.body; fall back to reading the
    // stream ourselves if it did not.
    const preparsed = (req as IncomingMessage & { body?: unknown }).body;
    let raw: unknown = preparsed;
    if (raw === undefined) {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const text = Buffer.concat(chunks).toString('utf8');
      raw = text ? JSON.parse(text) : undefined;
    }

    stage = 'import';
    const { callKimi } = await import('../apps/api/src/kimi.ts');
    const { parseChatBody, runTurn } = await import('../apps/api/src/turn.ts');

    stage = 'parse';
    const body = parseChatBody(raw);
    if (!body) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'invalid request body' }));
      return;
    }

    stage = 'stream';
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });

    try {
      for await (const ev of runTurn(body, callKimi)) {
        res.write(`event: ${ev.event}\ndata: ${JSON.stringify(ev.data)}\n\n`);
      }
    } catch (err) {
      console.error('[api/chat] stream failed:', err);
      res.write(
        `event: error\ndata: ${JSON.stringify({
          kind: 'api',
          message: 'Se cayó la conexión con el modelo. Tus datos siguen acá.',
        })}\n\n`,
      );
    } finally {
      res.end();
    }
  } catch (err) {
    console.error(`[api/chat] failed at stage "${stage}":`, err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({ stage, error: err instanceof Error ? `${err.name}: ${err.message}` : String(err) }),
      );
    } else {
      res.end();
    }
  }
}
