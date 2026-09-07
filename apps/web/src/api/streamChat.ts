import type { PinnedField } from '@chat/shared';

export interface SSEEvent {
  event: string;
  data: unknown;
}

export interface ChatRequest {
  messages: { role: 'user' | 'assistant'; content: string }[];
  fields: PinnedField[];
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

// Empty in dev, where Vite proxies /api to the local server. In production
// this points at the deployed API, which lives on another origin.
const API_BASE = import.meta.env.VITE_API_URL ?? '';

export async function streamChat(
  body: ChatRequest,
  onEvent: (e: SSEEvent) => void,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  let res: Awaited<ReturnType<typeof fetch>>;
  try {
    res = await fetchImpl(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    onEvent({ event: 'error', data: { message: 'Se cayó la conexión con el modelo.' } });
    return;
  }

  if (!res.ok || !res.body) {
    onEvent({ event: 'error', data: { message: 'Se cayó la conexión con el modelo.' } });
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
        if (e.event === 'envelope' || e.event === 'fallback' || e.event === 'error') {
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
      data: { message: 'Se cortó la conexión antes de terminar. Intenta de nuevo.' },
    });
  }
}
