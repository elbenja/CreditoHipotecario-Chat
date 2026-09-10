// Must be first: BASE_URL/MODEL below are read at module-evaluation time, and
// the repo-root .env is invisible from apps/api without this.
import './env.ts';

import OpenAI from 'openai';
import type { ChatMessage } from './prompt.ts';

const BASE_URL = process.env.MOONSHOT_BASE_URL ?? 'https://api.moonshot.ai/v1';
// kimi-k2.7-code-highspeed, not kimi-k2.6: measured on this workload, k2.6
// spends ~112s "thinking" before its first token while highspeed answers in
// ~16s, for identical envelope quality and identical (exact) mortgage
// arithmetic. See docs/superpowers/specs — latency section.
const MODEL = process.env.MOONSHOT_MODEL ?? 'kimi-k2.7-code-highspeed';

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

/** Returns the raw assistant text. Parsing and validation belong to the pipeline. */
export async function callKimi(messages: ChatMessage[]): Promise<ModelReply> {
  const res = await getClient().chat.completions.create({
    model: MODEL,
    // ChatMessage is a discriminated union keyed on role, exactly like the
    // SDK's own ChatCompletionMessageParam union (only a user turn may carry
    // image_url parts), so it satisfies the SDK type structurally — no cast.
    messages,
    // No temperature: the Moonshot models used here reject anything but 1
    // ("invalid temperature: only 1 is allowed for this model"), so let the
    // model default apply rather than sending a value it refuses.
    // Generous on purpose: these models spend reasoning tokens before emitting
    // any content. Measured on a page-1 crop: ~2,200 completion tokens, almost
    // all of them reasoning. A low ceiling yields '' and no error at all.
    max_tokens: 4000,
    response_format: { type: 'json_object' },
  });
  const choice = res.choices[0];
  return {
    content: choice?.message?.content ?? '',
    truncated: choice?.finish_reason === 'length',
  };
}
