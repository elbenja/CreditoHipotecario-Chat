import { PinnedFieldSchema, isListingHost } from '@chat/shared';
import { z } from 'zod';
import { canonicalListingUrl, fetchListingText, type FetchListing } from './listing/fetchListing.ts';
import { runDocumentPipeline } from './pipeline/document.ts';
import { runPipeline } from './pipeline/index.ts';
import { runListingPipeline } from './pipeline/listing.ts';
import { isOutOfScope, refusalEnvelope } from './pipeline/scope.ts';
import { buildDocumentMessages, buildListingMessages, buildMessages, type ChatMessage } from './prompt.ts';
import { ModelCallError, type ModelMode, type ModelReply } from './kimi.ts';
import { COPY, LANGS, type Lang } from './i18n.ts';

const DocumentSchema = z.union([
  z.object({ kind: z.literal('text'), text: z.string().min(1) }),
  z.object({
    kind: z.literal('image'),
    // Data URLs only. A remote URL would make the API fetch whatever a caller
    // names, which is not something this endpoint should ever do.
    dataUrl: z.string().regex(/^data:image\/(jpeg|png);base64,/),
  }),
]);

// The browser already checked the host; check it again here because this
// endpoint is public and the body is whatever the caller sends.
const ListingRequestSchema = z.object({
  url: z
    .string()
    .url()
    .refine((u) => {
      try {
        return isListingHost(new URL(u).hostname);
      } catch {
        return false;
      }
    }, 'host not allowed')
    .refine((u) => {
      try {
        return new URL(u).protocol === 'http:' || new URL(u).protocol === 'https:';
      } catch {
        return false;
      }
    }, 'scheme not allowed'),
});

const BodySchema = z.object({
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() }))
    .transform((messages) => messages.filter((message) => message.content.trim().length > 0))
    .refine((messages) => messages.length > 0),
  fields: z.array(PinnedFieldSchema).default([]),
  document: DocumentSchema.optional(),
  listing: ListingRequestSchema.optional(),
  // Older clients send no language: they were Spanish-only.
  lang: z.enum(LANGS).default('es'),
});

export type ChatBody = z.infer<typeof BodySchema>;
export interface SSEEvent { event: string; data: unknown }
export type CallModel = (messages: ChatMessage[], mode: ModelMode) => Promise<ModelReply>;

export function parseChatBody(raw: unknown): ChatBody | null {
  const parsed = BodySchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function modelErrorData(error: unknown, copy = COPY.es): { kind: 'request' | 'api'; message: string } {
  if (error instanceof ModelCallError && error.kind === 'request') {
    return { kind: 'request', message: copy.errRequest };
  }
  return { kind: 'api', message: copy.errApi };
}

/**
 * One chat turn, as a stream of SSE events. Transport-agnostic on purpose:
 * the Fastify server and the Vercel function both drive this, so local and
 * deployed behaviour cannot drift.
 */
export async function* runTurn(
  body: Omit<ChatBody, 'lang'> & { lang?: Lang },
  callModel: CallModel,
  fetchListing: FetchListing = fetchListingText,
): AsyncGenerator<SSEEvent> {
  const { messages, fields } = body;
  const lang = body.lang ?? 'es';
  const copy = COPY[lang];

  yield { event: 'status', data: { phase: 'thinking' } };

  // A link turn, like a document turn, branches before the guardrail: the
  // message is the URL and the page is the payload.
  if (body.listing) {
    const { url } = body.listing;
    // Stamp fuente from the canonical form, not whatever spelling the request
    // used (www., http://, userinfo, port): the host the user reads is always
    // 'nexoinmobiliario.pe'.
    const canonicalUrl = canonicalListingUrl(url);
    yield { event: 'analyzeStep', data: { label: copy.analyzeListing } };
    yield { event: 'status', data: { phase: 'analyzing' } };

    let text: string;
    try {
      // A non-listing Nexo page (search results, a project index) can be far
      // larger than the ~11k chars a listing reduces to, and this is a public
      // endpoint — cap what actually reaches the model.
      text = (await fetchListing(canonicalUrl)).slice(0, 60_000);
    } catch (err) {
      console.error('[chat] listing fetch failed:', err);
      yield { event: 'status', data: { phase: 'streaming' } };
      yield {
        event: 'error',
        data: { kind: 'listing', message: copy.errListingFetch },
      };
      return;
    }

    try {
      const { content } = await callModel(buildListingMessages(text), 'document');
      const result = runListingPipeline(content, { host: 'nexoinmobiliario.pe', url: canonicalUrl });
      yield { event: 'status', data: { phase: 'streaming' } };
      if (result.ok) {
        yield { event: 'listing', data: { listing: result.listing } };
      } else {
        yield {
          event: 'error',
          data: {
            kind: 'listing',
            message: result.reason === 'notListing' ? copy.errNotListing : copy.errListingUnreadable,
          },
        };
      }
    } catch (err) {
      console.error('[chat] listing extraction failed:', err);
      yield { event: 'error', data: modelErrorData(err, copy) };
    }
    return;
  }

  // Document turns branch before the out-of-scope guardrail: on an upload the
  // accompanying message text is incidental or odd (or literally off-topic),
  // and the document itself is the payload — the guardrail must not eat it.
  if (body.document) {
    // The browser already read page 1 by the time this arrives; the model's
    // job is the extraction, and the progress row says so.
    yield { event: 'analyzeStep', data: { label: copy.analyzeDocument } };
    yield { event: 'status', data: { phase: 'analyzing' } };
    try {
      const { content } = await callModel(buildDocumentMessages(body.document), 'document');
      const result = runDocumentPipeline(content, lang);
      yield { event: 'status', data: { phase: 'streaming' } };
      if (result.ok && result.kind === 'cronograma') {
        yield { event: 'extraction', data: { fields: result.fields } };
      } else if (result.ok) {
        yield { event: 'listing', data: { listing: result.listing } };
      } else {
        yield {
          event: 'error',
          data: {
            kind: 'document',
            message: result.reason === 'otro' ? copy.errDocumentOther : copy.errDocumentUnreadable,
          },
        };
      }
    } catch (err) {
      console.error('[chat] document extraction failed:', err);
      yield {
        event: 'error',
        data: modelErrorData(err, copy),
      };
    }
    return;
  }

  // Guardrail: refuse off-topic turns before spending a model call.
  // Only the latest user turn is checked — earlier context is already scoped.
  const latest = messages.filter((m) => m.role === 'user').at(-1);
  if (latest && isOutOfScope(latest.content)) {
    yield { event: 'status', data: { phase: 'streaming' } };
    yield { event: 'envelope', data: { envelope: refusalEnvelope(lang), truncated: false, outOfScope: true } };
    return;
  }

  yield { event: 'analyzeStep', data: { label: copy.analyzeChat } };
  yield { event: 'status', data: { phase: 'analyzing' } };

  try {
    const { content, truncated } = await callModel(buildMessages(messages, fields, lang), 'chat');
    if (!content.trim()) {
      yield {
        event: 'error',
        data: truncated
          ? { kind: 'limit', message: copy.errLimit }
          : { kind: 'api', message: copy.errEmpty },
      };
      return;
    }
    const userTurns = messages.filter((m) => m.role === 'user').map((m) => m.content);
    const previousAssistant = messages.filter((m) => m.role === 'assistant').at(-1)?.content ?? '';
    const result = runPipeline(content, userTurns, previousAssistant, lang);

    yield { event: 'status', data: { phase: 'streaming' } };
    if (result.ok) {
      yield { event: 'envelope', data: { envelope: result.envelope, truncated } };
    } else {
      yield { event: 'fallback', data: { prose: result.prose, candidates: result.candidates, truncated } };
    }
  } catch (err) {
    // Log the real error; the user gets their language, not an SDK string.
    console.error('[chat] model call failed:', err);
    yield { event: 'error', data: modelErrorData(err, copy) };
  }
}
