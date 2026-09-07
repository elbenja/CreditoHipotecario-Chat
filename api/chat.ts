// A model reply takes 15-35s, so the default duration is not enough.
export const config = { maxDuration: 60 };

/**
 * Imports are dynamic and inside the try on purpose. A static import that
 * throws while the module graph loads kills the function before any handler
 * exists, and Vercel can only report FUNCTION_INVOCATION_FAILED — which names
 * nothing. Loading here turns that same failure into a readable message.
 */
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

  let stage = 'import';
  try {
    const { callKimi } = await import('../apps/api/src/kimi.ts');
    const { parseChatBody, runTurn } = await import('../apps/api/src/turn.ts');

    stage = 'parse';
    const body = parseChatBody(raw);
    if (!body) return Response.json({ error: 'invalid request body' }, { status: 400 });

    stage = 'stream';
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const ev of runTurn(body, callKimi)) {
            controller.enqueue(
              encoder.encode(`event: ${ev.event}\ndata: ${JSON.stringify(ev.data)}\n\n`),
            );
          }
        } catch (err) {
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({
                kind: 'api',
                message: 'Se cayó la conexión con el modelo. Tus datos siguen acá.',
              })}\n\n`,
            ),
          );
          console.error('[api/chat] stream failed:', err);
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
  } catch (err) {
    console.error(`[api/chat] failed at stage "${stage}":`, err);
    return Response.json(
      { stage, error: err instanceof Error ? `${err.name}: ${err.message}` : String(err) },
      { status: 500 },
    );
  }
}
