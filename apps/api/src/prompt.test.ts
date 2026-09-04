import type { PinnedField } from '@chat/shared';
import { describe, expect, it } from 'vitest';
import { SYSTEM_PROMPT, buildMessages } from './prompt.ts';

describe('SYSTEM_PROMPT', () => {
  it('states the Peruvian market', () => {
    expect(SYSTEM_PROMPT).toMatch(/Per[úu]/);
  });

  it('specifies the TEA convention rather than dividing by twelve', () => {
    expect(SYSTEM_PROMPT).toMatch(/TEA/);
    expect(SYSTEM_PROMPT).toMatch(/1\/12/);
  });

  it('caps prose and follow-ups at three', () => {
    expect(SYSTEM_PROMPT).toMatch(/m[áa]ximo 3 p[áa]rrafos/i);
    expect(SYSTEM_PROMPT).toMatch(/exactamente 3/i);
  });

  it('defines the scope boundary for refusals', () => {
    expect(SYSTEM_PROMPT).toMatch(/fuera de alcance/i);
  });

  it('requires the house number format', () => {
    expect(SYSTEM_PROMPT).toContain('S/ 1,750');
  });

  it('forbids claiming user provenance for inferred values', () => {
    expect(SYSTEM_PROMPT).toMatch(/assumed/);
  });
});

describe('buildMessages', () => {
  const field: PinnedField = {
    key: 'precio',
    label: 'Precio de compra',
    value: '250,000',
    provenance: 'user',
    note: '',
  };

  it('puts the system prompt first', () => {
    const msgs = buildMessages([{ role: 'user', content: 'hola' }], []);
    expect(msgs[0]).toEqual({ role: 'system', content: SYSTEM_PROMPT });
  });

  it('preserves conversation order', () => {
    const msgs = buildMessages(
      [
        { role: 'user', content: 'uno' },
        { role: 'assistant', content: 'dos' },
      ],
      [],
    );
    expect(msgs.at(-1)).toEqual({ role: 'assistant', content: 'dos' });
  });

  it('injects the pinned fields as system context when present', () => {
    const msgs = buildMessages([{ role: 'user', content: 'hola' }], [field]);
    const injected = msgs.filter((m) => m.role === 'system');
    expect(injected).toHaveLength(2);
    expect(injected[1]!.content).toContain('250,000');
  });

  it('omits the field block when nothing is pinned', () => {
    const msgs = buildMessages([{ role: 'user', content: 'hola' }], []);
    expect(msgs.filter((m) => m.role === 'system')).toHaveLength(1);
  });
});
