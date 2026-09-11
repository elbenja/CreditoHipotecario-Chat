import { describe, expect, it } from 'vitest';
import { parseChatBody, runTurn } from './turn.ts';

const EXTRACTION = JSON.stringify({ tea: '6.30 %', cuota: '3,051.10', dudosos: [] });

async function collect(body: Parameters<typeof runTurn>[0], reply: string) {
  const out = [];
  for await (const e of runTurn(body, async () => ({ content: reply, truncated: false }))) {
    out.push(e);
  }
  return out;
}

describe('document turns', () => {
  it('accepts a body carrying a document', () => {
    const b = parseChatBody({
      messages: [{ role: 'user', content: 'te mando mi cronograma' }],
      document: { kind: 'text', text: 'TEA: 6.30 %' },
    });
    expect(b?.document?.kind).toBe('text');
  });

  it('rejects a document with neither text nor a data URL', () => {
    expect(parseChatBody({
      messages: [{ role: 'user', content: 'x' }],
      document: { kind: 'image', dataUrl: 'https://evil.example/x.jpg' },
    })).toBeNull();
  });

  it('emits an extraction event with the read fields', async () => {
    const events = await collect(
      { messages: [{ role: 'user', content: 'mi cronograma' }], fields: [],
        document: { kind: 'text', text: 'TEA 6.30' } },
      EXTRACTION,
    );
    const extraction = events.find((e) => e.event === 'extraction');
    expect(extraction).toBeDefined();
    const data = extraction!.data as { fields: { key: string }[] };
    expect(data.fields.map((f) => f.key).sort()).toEqual(['cuota', 'tea']);
  });

  it('uses the document model policy for extraction', async () => {
    const modes: (string | undefined)[] = [];
    for await (const _event of runTurn(
      { messages: [{ role: 'user', content: 'mi cronograma' }], fields: [],
        document: { kind: 'text', text: 'TEA 6.30' } },
      async (_messages, mode) => {
        modes.push(mode);
        return { content: EXTRACTION, truncated: false };
      },
    )) { /* consume */ }
    expect(modes).toEqual(['document']);
  });

  it('emits a document error when the reply is not a schedule', async () => {
    const events = await collect(
      { messages: [{ role: 'user', content: 'mi cronograma' }], fields: [],
        document: { kind: 'text', text: 'una receta de causa' } },
      JSON.stringify({ dudosos: [] }),
    );
    const err = events.find((e) => e.event === 'error');
    expect((err!.data as { kind: string }).kind).toBe('document');
    expect((err!.data as { message: string }).message).toMatch(/cronograma/i);
  });

  it('does not run the out-of-scope guardrail on a document turn', async () => {
    // The user message accompanying an upload is often bare or odd; the
    // document is the payload, so the text guardrail must not eat the turn.
    const events = await collect(
      { messages: [{ role: 'user', content: 'bitcoin' }], fields: [],
        document: { kind: 'text', text: 'TEA 6.30' } },
      EXTRACTION,
    );
    expect(events.some((e) => e.event === 'extraction')).toBe(true);
  });
});
