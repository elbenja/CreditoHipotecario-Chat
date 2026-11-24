import { describe, expect, it } from 'vitest';
import { accessToken } from '../access.ts';
import type { DemoConfig } from '../demo.ts';
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

const chatPayload = { messages: [{ role: 'user', content: 'hola' }], fields: [] };

function setup(config: Partial<DemoConfig> | null = {}) {
  const calls = { count: 0 };
  const app = buildServer({
    callModel: async () => {
      calls.count += 1;
      return { content: JSON.stringify(envelope), truncated: false };
    },
    accessPassword: 'Secreto',
    demo: config === null ? undefined : { turns: 2, dailyTurns: 100, sessionsPerIp: 3, ...config },
  });
  const mint = (ip = '1.1.1.1') =>
    app.inject({ method: 'POST', url: '/api/demo', headers: { 'x-forwarded-for': ip } });
  const chat = (token: string, payload: object = chatPayload) =>
    app.inject({ method: 'POST', url: '/api/chat', payload, headers: { authorization: `Bearer ${token}` } });
  return { app, calls, mint, chat };
}

function firstEvent(body: string) {
  const block = body.split('\n\n')[0]!;
  return { event: /^event: (.+)$/m.exec(block)?.[1], data: JSON.parse(/^data: (.+)$/m.exec(block)?.[1] ?? '{}') };
}

describe('demo access', () => {
  it('mints a token that chats and reports the turns left first', async () => {
    const { mint, chat } = setup();
    const minted = await mint();
    expect(minted.statusCode).toBe(200);
    const { token, remaining } = minted.json();
    expect(token).toMatch(/^demo\.[^.]+\.[0-9a-f]{64}$/);
    expect(remaining).toBe(2);

    const res = await chat(token);
    expect(res.statusCode).toBe(200);
    expect(firstEvent(res.body)).toEqual({ event: 'demo', data: { remaining: 1 } });
    expect(res.body).toContain('event: envelope');
  });

  it('refuses a token once its turns are spent', async () => {
    const { mint, chat, calls } = setup();
    const { token } = (await mint()).json();
    expect(firstEvent((await chat(token)).body).data).toEqual({ remaining: 1 });
    expect(firstEvent((await chat(token)).body).data).toEqual({ remaining: 0 });
    const res = await chat(token);
    expect(res.statusCode).toBe(429);
    expect(res.json()).toEqual({ error: 'demo-limit' });
    expect(calls.count).toBe(2);
  });

  it('keeps documents and listings out of the demo, without a model call or a spent turn', async () => {
    const { mint, chat, calls } = setup();
    const { token } = (await mint()).json();
    const doc = await chat(token, { ...chatPayload, document: { kind: 'text', text: 'TEA: 6.30 %' } });
    const listing = await chat(token, {
      ...chatPayload,
      listing: { url: 'https://nexoinmobiliario.pe/departamentos/barranco/aspiria-1631' },
    });
    expect(doc.statusCode).toBe(403);
    expect(doc.json()).toEqual({ error: 'demo-scope' });
    expect(listing.statusCode).toBe(403);
    expect(calls.count).toBe(0);
    expect(firstEvent((await chat(token)).body).data).toEqual({ remaining: 1 });
  });

  it('stops every token, and new mints, once the daily budget is spent', async () => {
    const { mint, chat } = setup({ dailyTurns: 3 });
    const a = (await mint('1.1.1.1')).json().token;
    const b = (await mint('2.2.2.2')).json().token;
    await chat(a);
    await chat(a);
    expect((await chat(b)).statusCode).toBe(200);
    const res = await chat(b);
    expect(res.statusCode).toBe(429);
    expect(res.json()).toEqual({ error: 'demo-limit' });
    const late = await mint('3.3.3.3');
    expect(late.statusCode).toBe(429);
    expect(late.json()).toEqual({ error: 'demo-unavailable' });
  });

  it('limits how many sessions one IP mints per day', async () => {
    const { mint } = setup({ sessionsPerIp: 2 });
    expect((await mint('1.1.1.1')).statusCode).toBe(200);
    expect((await mint('1.1.1.1')).statusCode).toBe(200);
    const third = await mint('1.1.1.1');
    expect(third.statusCode).toBe(429);
    expect(third.json()).toEqual({ error: 'demo-unavailable' });
    expect((await mint('2.2.2.2')).statusCode).toBe(200);
  });

  it('resets the counters when the UTC day changes', async () => {
    let clock = Date.UTC(2026, 10, 24, 23, 59);
    const { mint, chat } = setup({ sessionsPerIp: 1, now: () => clock });
    const { token } = (await mint()).json();
    await chat(token);
    await chat(token);
    expect((await chat(token)).statusCode).toBe(429);
    expect((await mint()).statusCode).toBe(429);

    clock = Date.UTC(2026, 10, 25, 0, 1);
    expect((await mint()).statusCode).toBe(200);
    expect(firstEvent((await chat(token)).body).data).toEqual({ remaining: 1 });
  });

  it('honours a validly signed token the server no longer remembers', async () => {
    const before = setup();
    const { token } = (await before.mint()).json();
    await before.chat(token);
    // A restart: same password, empty memory.
    const after = setup();
    expect(firstEvent((await after.chat(token)).body).data).toEqual({ remaining: 1 });
  });

  it('refuses a forged token', async () => {
    const { mint, chat, calls } = setup();
    const { token } = (await mint()).json();
    const id = token.split('.')[1];
    for (const forged of [`demo.${id}.${'0'.repeat(64)}`, `demo.other-id.${token.split('.')[2]}`]) {
      const res = await chat(forged);
      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({ error: 'locked' });
    }
    expect(calls.count).toBe(0);
  });

  it('leaves the full-access token unlimited and without a demo event', async () => {
    const { chat } = setup({ turns: 1, dailyTurns: 1 });
    for (let i = 0; i < 3; i++) {
      const res = await chat(accessToken('Secreto'));
      expect(res.statusCode).toBe(200);
      expect(res.body).not.toContain('event: demo');
    }
  });

  it('is off without a config or with zero turns', async () => {
    const live = setup();
    const { token } = (await live.mint()).json();
    for (const off of [setup(null), setup({ turns: 0 })]) {
      expect((await off.mint()).statusCode).toBe(404);
      expect((await off.chat(token)).statusCode).toBe(401);
    }
  });
});
