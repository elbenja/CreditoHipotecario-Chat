import { describe, expect, it } from 'vitest';
import { accessToken } from '../access.ts';
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

function server() {
  return buildServer({
    callModel: async () => ({ content: JSON.stringify(envelope), truncated: false }),
    accessPassword: 'Secreto',
  });
}

const chatPayload = { messages: [{ role: 'user', content: 'hola' }], fields: [] };

describe('password gate', () => {
  it('trades the right password for a token, ignoring case and spaces', async () => {
    const res = await server().inject({ method: 'POST', url: '/api/unlock', payload: { password: '  secreto ' } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ token: accessToken('Secreto') });
  });

  it('refuses a wrong or missing password', async () => {
    const app = server();
    expect((await app.inject({ method: 'POST', url: '/api/unlock', payload: { password: 'nope' } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/unlock', payload: {} })).statusCode).toBe(401);
  });

  it('locks /api/chat without a valid token, before the model is called', async () => {
    let called = false;
    const app = buildServer({
      callModel: async () => {
        called = true;
        return { content: JSON.stringify(envelope), truncated: false };
      },
      accessPassword: 'Secreto',
    });
    const none = await app.inject({ method: 'POST', url: '/api/chat', payload: chatPayload });
    const bad = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: chatPayload,
      headers: { authorization: `Bearer ${accessToken('otra')}` },
    });
    expect(none.statusCode).toBe(401);
    expect(bad.statusCode).toBe(401);
    expect(called).toBe(false);
  });

  it('streams a reply with the token', async () => {
    const res = await server().inject({
      method: 'POST',
      url: '/api/chat',
      payload: chatPayload,
      headers: { authorization: `Bearer ${accessToken('Secreto')}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('event: envelope');
  });
});
