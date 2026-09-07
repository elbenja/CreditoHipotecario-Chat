import { callKimi } from '../apps/api/src/kimi.ts';
import { parseChatBody, runTurn } from '../apps/api/src/turn.ts';

// A model reply takes 15-35s, so the default duration is not enough.
export const config = { maxDuration: 60 };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: 'invalid request body' }, { status: 400 });
  }

  const body = parseChatBody(raw);
  if (!body) return Response.json({ error: 'invalid request body' }, { status: 400 });

  try {
    return streamTurn(body);
  } catch (err) {
    // Surface the real reason rather than an opaque FUNCTION_INVOCATION_FAILED.
    console.error('[api/chat] failed:', err);
    return Response.json(
      { error: 'chat handler failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

function streamTurn(body: ReturnType<typeof parseChatBody> & {}): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const ev of runTurn(body, callKimi)) {
          controller.enqueue(encoder.encode(`event: ${ev.event}\ndata: ${JSON.stringify(ev.data)}\n\n`));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
