import { PinnedFieldSchema } from '@chat/shared';
import { z } from 'zod';
import { runDocumentPipeline } from './pipeline/document.ts';
import { runPipeline } from './pipeline/index.ts';
import { REFUSAL_ENVELOPE, isOutOfScope } from './pipeline/scope.ts';
import { buildDocumentMessages, buildMessages, type ChatMessage } from './prompt.ts';
import type { ModelReply } from './kimi.ts';

const DocumentSchema = z.union([
  z.object({ kind: z.literal('text'), text: z.string().min(1) }),
  z.object({
    kind: z.literal('image'),
    // Data URLs only. A remote URL would make the API fetch whatever a caller
    // names, which is not something this endpoint should ever do.
    dataUrl: z.string().regex(/^data:image\/(jpeg|png);base64,/),
  }),
]);

const BodySchema = z.object({
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })).min(1),
  fields: z.array(PinnedFieldSchema).default([]),
  document: DocumentSchema.optional(),
});

export type ChatBody = z.infer<typeof BodySchema>;
export interface SSEEvent { event: string; data: unknown }
export type CallModel = (messages: ChatMessage[]) => Promise<ModelReply>;

/** Steps shown while waiting. Real labels — this is where trust is built. */
const ANALYZE_STEPS = ['Leyendo tu mensaje y los datos de la propiedad'];

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

  // Document turns branch before the out-of-scope guardrail: on an upload the
  // accompanying message text is incidental or odd (or literally off-topic),
  // and the document itself is the payload — the guardrail must not eat it.
  if (body.document) {
    // The browser already read page 1 by the time this arrives; the model's
    // job is the extraction, and the progress row says so.
    yield { event: 'analyzeStep', data: { label: 'Extrayendo las condiciones' } };
    yield { event: 'status', data: { phase: 'analyzing' } };
    try {
      const { content } = await callModel(buildDocumentMessages(body.document));
      const result = runDocumentPipeline(content);
      yield { event: 'status', data: { phase: 'streaming' } };
      if (result.ok) {
        yield { event: 'extraction', data: { fields: result.fields } };
      } else {
        yield {
          event: 'error',
          data: {
            kind: 'document',
            message:
              result.reason === 'noSchedule'
                ? 'Esto no parece un cronograma de pagos. Revisa que sea la primera página.'
                : 'No pude leer las condiciones de ese cronograma.',
          },
        };
      }
    } catch (err) {
      console.error('[chat] document extraction failed:', err);
      yield {
        event: 'error',
        data: { kind: 'api', message: 'Se cayó la conexión con el modelo. Tus datos siguen acá.' },
      };
    }
    return;
  }

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
