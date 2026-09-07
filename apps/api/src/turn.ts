import { PinnedFieldSchema } from '@chat/shared';
import { z } from 'zod';
import { runPipeline } from './pipeline/index.ts';
import { REFUSAL_ENVELOPE, isOutOfScope } from './pipeline/scope.ts';
import { buildMessages, type ChatMessage } from './prompt.ts';
import type { ModelReply } from './kimi.ts';

const BodySchema = z.object({
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })).min(1),
  fields: z.array(PinnedFieldSchema).default([]),
});

export type ChatBody = z.infer<typeof BodySchema>;
export interface SSEEvent { event: string; data: unknown }
export type CallModel = (messages: ChatMessage[]) => Promise<ModelReply>;

/** Steps shown while waiting. Real labels — this is where trust is built. */
const ANALYZE_STEPS = [
  'Leyendo lo que me contaste',
  'Contrastando precio por m² del distrito',
  'Calculando cuota y flujo mensual',
];

export function parseChatBody(raw: unknown): ChatBody | null {
  const parsed = BodySchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * One chat turn, as a stream of SSE events. Transport-agnostic on purpose:
 * the Fastify server and the Vercel function both drive this, so local and
 * deployed behaviour cannot drift.
 */
export async function* runTurn(body: ChatBody, callModel: CallModel): AsyncGenerator<SSEEvent> {
  const { messages, fields } = body;

  yield { event: 'status', data: { phase: 'thinking' } };

  // Guardrail: refuse off-topic turns before spending a model call.
  // Only the latest user turn is checked — earlier context is already scoped.
  const latest = messages.filter((m) => m.role === 'user').at(-1);
  if (latest && isOutOfScope(latest.content)) {
    yield { event: 'status', data: { phase: 'streaming' } };
    yield { event: 'envelope', data: { envelope: REFUSAL_ENVELOPE, truncated: false, outOfScope: true } };
    return;
  }

  for (const label of ANALYZE_STEPS) yield { event: 'analyzeStep', data: { label } };
  yield { event: 'status', data: { phase: 'analyzing' } };

  try {
    const { content, truncated } = await callModel(buildMessages(messages, fields));
    const userTurns = messages.filter((m) => m.role === 'user').map((m) => m.content);
    const result = runPipeline(content, userTurns);

    yield { event: 'status', data: { phase: 'streaming' } };
    if (result.ok) {
      yield { event: 'envelope', data: { envelope: result.envelope, truncated } };
    } else {
      yield { event: 'fallback', data: { prose: result.prose, candidates: result.candidates, truncated } };
    }
  } catch (err) {
    // Log the real error; the user gets Spanish, not an SDK string.
    console.error('[chat] model call failed:', err);
    yield { event: 'error', data: { kind: 'api', message: 'Se cayó la conexión con el modelo. Tus datos siguen acá.' } };
  }
}
