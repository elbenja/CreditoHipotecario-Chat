// Must be first: BASE_URL/MODEL below are read at module-evaluation time, and
// the repo-root .env is invisible from apps/api without this.
import './env.ts';

import OpenAI from 'openai';
import type { ChatMessage } from './prompt.ts';

const BASE_URL = process.env.MOONSHOT_BASE_URL ?? 'https://api.moonshot.ai/v1';
const DOCUMENT_MODEL = process.env.MOONSHOT_DOCUMENT_MODEL
  ?? process.env.MOONSHOT_MODEL
  ?? 'kimi-k2.7-code-highspeed';
const CHAT_MODEL = process.env.MOONSHOT_CHAT_MODEL ?? 'kimi-k2.6';

/** Enough for the compact JSON contract, without funding an unbounded reasoning trace. */
export const CHAT_COMPLETION_LIMIT = 1200;
const DOCUMENT_COMPLETION_LIMIT = 4000;

export type ModelMode = 'chat' | 'document';

export function getModelPolicy(mode: ModelMode): {
  model: string;
  maxCompletionTokens: number;
  thinking?: { type: 'disabled' };
} {
  return mode === 'chat'
    ? { model: CHAT_MODEL, maxCompletionTokens: CHAT_COMPLETION_LIMIT, thinking: { type: 'disabled' } }
    : { model: DOCUMENT_MODEL, maxCompletionTokens: DOCUMENT_COMPLETION_LIMIT };
}

let client: OpenAI | null = null;

function getClient(): OpenAI {
  const apiKey = process.env.MOONSHOT_API_KEY;
  if (!apiKey) throw new Error('MOONSHOT_API_KEY is not set');
  client ??= new OpenAI({ apiKey, baseURL: BASE_URL });
  return client;
}

export interface ModelReply {
  content: string;
  /** The model stopped because it hit the token ceiling, not because it finished. */
  truncated: boolean;
}

export type ModelErrorKind = 'request' | 'connection' | 'upstream';

export class ModelCallError extends Error {
  readonly kind: ModelErrorKind;
  readonly status?: number;

  constructor(
    kind: ModelErrorKind,
    message: string,
    status?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ModelCallError';
    this.kind = kind;
    this.status = status;
  }
}

export function classifyModelError(error: unknown): { kind: ModelErrorKind; status?: number } {
  const value = typeof error === 'object' && error !== null
    ? error as { status?: unknown; name?: unknown }
    : {};
  const status = typeof value.status === 'number' ? value.status : undefined;
  if (status === 400) return { kind: 'request', status };
  if (error instanceof TypeError || value.name === 'APIConnectionError') return { kind: 'connection' };
  return status === undefined ? { kind: 'connection' } : { kind: 'upstream', status };
}

/** Returns the raw assistant text. Parsing and validation belong to the pipeline. */
export async function callKimi(messages: ChatMessage[], mode: ModelMode = 'chat'): Promise<ModelReply> {
  try {
    const policy = getModelPolicy(mode);
    const request = {
      model: policy.model,
      // ChatMessage is a discriminated union keyed on role, exactly like the
      // SDK's own ChatCompletionMessageParam union.
      messages,
      // This product needs a small structured answer, not a hidden reasoning
      // trace. Disabling thinking makes the ceiling apply to useful JSON.
      ...(policy.thinking ? { thinking: policy.thinking } : {}),
      max_completion_tokens: policy.maxCompletionTokens,
      response_format: { type: 'json_object' as const },
    };
    const res = await getClient().chat.completions.create(request);
    const choice = res.choices[0];
    const details = res.usage?.prompt_tokens_details;
    console.info(
      `[kimi] mode=${mode} finish=${choice?.finish_reason ?? 'none'} input=${res.usage?.prompt_tokens ?? 0} ` +
      `cached=${details?.cached_tokens ?? 0} output=${res.usage?.completion_tokens ?? 0}`,
    );
    return {
      content: choice?.message?.content ?? '',
      truncated: choice?.finish_reason === 'length',
    };
  } catch (error) {
    const classified = classifyModelError(error);
    const message = error instanceof Error ? error.message : 'Model request failed';
    throw new ModelCallError(classified.kind, message, classified.status, { cause: error });
  }
}
