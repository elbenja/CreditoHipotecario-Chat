// Must be first: BASE_URL/MODEL below are read at module-evaluation time, and
// the repo-root .env is invisible from apps/api without this.
import './env.ts';

import OpenAI from 'openai';
import type { ChatMessage } from './prompt.ts';

const BASE_URL = process.env.MOONSHOT_BASE_URL ?? 'https://api.moonshot.ai/v1';
const MODEL = process.env.MOONSHOT_MODEL ?? 'kimi-k2.6';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  const apiKey = process.env.MOONSHOT_API_KEY;
  if (!apiKey) throw new Error('MOONSHOT_API_KEY is not set');
  client ??= new OpenAI({ apiKey, baseURL: BASE_URL });
  return client;
}

/** Returns the raw assistant text. Parsing and validation belong to the pipeline. */
export async function callKimi(messages: ChatMessage[]): Promise<string> {
  const res = await getClient().chat.completions.create({
    model: MODEL,
    messages,
    // No temperature: kimi-k2.6 rejects anything but 1
    // ("invalid temperature: only 1 is allowed for this model"), so let the
    // model default apply rather than sending a value it refuses.
    response_format: { type: 'json_object' },
  });
  return res.choices[0]?.message?.content ?? '';
}
