import { describe, expect, it, vi } from 'vitest';
import { buildServer } from './chat.ts';

const envelope = {
  verdict: 'Regular como negocio.',
  fields: [],
  metrics: [],
  scenarios: [],
  sources: [],
  prose: ['uno'],
  followUps: ['a', 'b', 'c'],
};

function parseEvents(body: string): { event: string; data: unknown }[] {
  return body
    .split('\n\n')
    .filter(Boolean)
    .map((block) => {
      const event = /^event: (.+)$/m.exec(block)?.[1] ?? '';
      const data = /^data: (.+)$/m.exec(block)?.[1] ?? '{}';
      return { event, data: JSON.parse(data) };
    });
}

async function post(callModel: () => Promise<string>, content = 'hola') {
  const app = buildServer({ callModel });
  const res = await app.inject({
    method: 'POST',
    url: '/api/chat',
    payload: { messages: [{ role: 'user', content }], fields: [] },
  });
  await app.close();
  return res;
}

describe('POST /api/chat', () => {
  it('responds with an event stream', async () => {
    const res = await post(async () => JSON.stringify(envelope));
    expect(res.headers['content-type']).toContain('text/event-stream');
  });

  it('emits a status event first', async () => {
    const res = await post(async () => JSON.stringify(envelope));
    expect(parseEvents(res.body)[0]!.event).toBe('status');
  });

  it('emits the envelope on a valid response', async () => {
    const res = await post(async () => JSON.stringify(envelope));
    const events = parseEvents(res.body);
    expect(events.at(-1)!.event).toBe('envelope');
  });

  it('emits fallback when the model breaks contract', async () => {
    const res = await post(async () => 'Con 30% de inicial la cuota baja.');
    const last = parseEvents(res.body).at(-1)!;
    expect(last.event).toBe('fallback');
    expect((last.data as { candidates: unknown[] }).candidates).toHaveLength(1);
  });

  it('emits error when the model call throws', async () => {
    const res = await post(async () => {
      throw new Error('upstream down');
    });
    expect(parseEvents(res.body).at(-1)!.event).toBe('error');
  });

  it('rejects a request with no messages', async () => {
    const app = buildServer({ callModel: async () => '' });
    const res = await app.inject({ method: 'POST', url: '/api/chat', payload: { messages: [], fields: [] } });
    await app.close();
    expect(res.statusCode).toBe(400);
  });

  it('refuses an out-of-scope question without calling the model', async () => {
    const callModel = vi.fn(async () => JSON.stringify(envelope));
    const app = buildServer({ callModel });
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: { messages: [{ role: 'user', content: '¿Me conviene invertir en bitcoin?' }], fields: [] },
    });
    await app.close();

    const last = parseEvents(res.body).at(-1)!;
    expect(last.event).toBe('envelope');
    expect((last.data as { envelope: { verdict: string } }).envelope.verdict).toMatch(/De eso no s[ée]/);
    expect(callModel).not.toHaveBeenCalled();
  });

  it('calls the model when property vocabulary is present', async () => {
    const callModel = vi.fn(async () => JSON.stringify(envelope));
    const app = buildServer({ callModel });
    await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: {
        messages: [{ role: 'user', content: '¿Bitcoin o comprar un depa en Lima?' }],
        fields: [],
      },
    });
    await app.close();
    expect(callModel).toHaveBeenCalledOnce();
  });
});
