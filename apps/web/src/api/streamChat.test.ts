import { describe, expect, it, vi } from 'vitest';
import { parseSSE, streamChat } from './streamChat';

describe('parseSSE', () => {
  it('parses a single event', () => {
    const out = parseSSE('event: status\ndata: {"phase":"thinking"}\n\n');
    expect(out).toEqual([{ event: 'status', data: { phase: 'thinking' } }]);
  });

  it('parses several events in one chunk', () => {
    const chunk = 'event: a\ndata: {"x":1}\n\nevent: b\ndata: {"y":2}\n\n';
    expect(parseSSE(chunk)).toHaveLength(2);
  });

  it('ignores an incomplete trailing block', () => {
    const out = parseSSE('event: a\ndata: {"x":1}\n\nevent: b\ndata: {"y"');
    expect(out).toHaveLength(1);
  });

  it('returns nothing for an empty chunk', () => {
    expect(parseSSE('')).toEqual([]);
  });
});

function mockFetch(body: string) {
  const encoder = new TextEncoder();
  return vi.fn(async () => ({
    ok: true,
    body: {
      getReader: () => {
        let sent = false;
        return {
          read: async () => {
            if (sent) return { done: true, value: undefined };
            sent = true;
            return { done: false, value: encoder.encode(body) };
          },
        };
      },
    },
  })) as unknown as typeof fetch;
}

describe('streamChat', () => {
  it('invokes the callback for each event', async () => {
    const seen: string[] = [];
    await streamChat(
      { messages: [{ role: 'user', content: 'hola' }], fields: [] },
      (e) => seen.push(e.event),
      mockFetch('event: status\ndata: {"phase":"thinking"}\n\nevent: envelope\ndata: {}\n\n'),
    );
    expect(seen).toEqual(['status', 'envelope']);
  });

  it('emits an error event when the response is not ok', async () => {
    const seen: { event: string }[] = [];
    const failing = vi.fn(async () => ({ ok: false, status: 500 })) as unknown as typeof fetch;
    await streamChat({ messages: [{ role: 'user', content: 'x' }], fields: [] }, (e) => seen.push(e), failing);
    expect(seen[0]!.event).toBe('error');
  });

  // A document turn's terminal event is 'extraction', not 'envelope' — the
  // stream closing right after it must not be mistaken for a dropped
  // connection.
  it('does not synthesise a dropped-connection error after an extraction event', async () => {
    const seen: string[] = [];
    await streamChat(
      { messages: [{ role: 'user', content: 'mi cronograma' }], fields: [], document: { kind: 'text', text: 'TEA 6.30' } },
      (e) => seen.push(e.event),
      mockFetch('event: status\ndata: {"phase":"analyzing"}\n\nevent: extraction\ndata: {"fields":[]}\n\n'),
    );
    expect(seen).toEqual(['status', 'extraction']);
  });
});
