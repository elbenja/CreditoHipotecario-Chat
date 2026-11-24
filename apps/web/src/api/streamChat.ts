import type { PinnedField } from '@chat/shared';
import type { DocumentInput } from '../pdf/readPdf';
import { getLang, t } from '../i18n';
import { getAccessToken, lockAccess } from './access';

/**
 * In production the API lives on another host. Locally this stays empty so the
 * Vite dev proxy keeps handling /api, and dev behaviour is unchanged.
 */
const API_BASE = (import.meta.env?.VITE_API_URL ?? '').replace(/\/$/, '');

export interface SSEEvent {
  event: string;
  data: unknown;
}

export interface ChatRequest {
  messages: { role: 'user' | 'assistant'; content: string }[];
  fields: PinnedField[];
  document?: DocumentInput;
  listing?: { url: string };
}

/** Parse whole `event:`/`data:` blocks. An incomplete trailing block is skipped. */
export function parseSSE(chunk: string): SSEEvent[] {
  const out: SSEEvent[] = [];
  for (const block of chunk.split('\n\n')) {
    const event = /^event: (.+)$/m.exec(block)?.[1];
    const data = /^data: (.+)$/m.exec(block)?.[1];
    if (!event || !data) continue;
    try {
      out.push({ event, data: JSON.parse(data) });
    } catch {
      // Incomplete JSON — the block is still arriving.
    }
  }
  return out;
}

export async function streamChat(
  body: ChatRequest,
  onEvent: (e: SSEEvent) => void,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  let res: Awaited<ReturnType<typeof fetch>>;
  try {
    res = await fetchImpl(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAccessToken() ?? ''}` },
      // The API writes its own copy, and tells the model, in this language.
      body: JSON.stringify({ ...body, lang: getLang() }),
    });
  } catch {
    onEvent({ event: 'error', data: { kind: 'api', message: t().errors.connection } });
    return;
  }

  // The token no longer opens the API: back to the password gate.
  if (res.status === 401) {
    lockAccess();
    onEvent({ event: 'error', data: { kind: 'api', message: t().errors.expired } });
    return;
  }

  if (!res.ok || !res.body) {
    onEvent({
      event: 'error',
      data: res.status === 400
        ? { kind: 'request', message: t().errors.badRequest }
        : { kind: 'api', message: t().errors.connection },
    });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let sawTerminal = false;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Keep the trailing partial block in the buffer.
      const lastBreak = buffer.lastIndexOf('\n\n');
      if (lastBreak === -1) continue;
      const complete = buffer.slice(0, lastBreak + 2);
      buffer = buffer.slice(lastBreak + 2);
      for (const e of parseSSE(complete)) {
        if (e.event === 'envelope' || e.event === 'fallback' || e.event === 'error' || e.event === 'extraction' || e.event === 'listing') {
          sawTerminal = true;
        }
        onEvent(e);
      }
    }
  } finally {
    reader.releaseLock?.();
  }

  if (!sawTerminal) {
    onEvent({
      event: 'error',
      data: { kind: 'api', message: t().errors.cutOff },
    });
  }
}
