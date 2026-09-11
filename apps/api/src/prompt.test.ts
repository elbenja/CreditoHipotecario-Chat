import type { PinnedField } from '@chat/shared';
import { describe, expect, it } from 'vitest';
import { SYSTEM_PROMPT, buildMessages, LISTING_PROMPT, buildListingMessages } from './prompt.ts';

describe('SYSTEM_PROMPT', () => {
  it('states the Peruvian market', () => {
    expect(SYSTEM_PROMPT).toMatch(/Per[úu]/);
  });

  it('specifies the TEA convention rather than dividing by twelve', () => {
    expect(SYSTEM_PROMPT).toMatch(/TEA/);
    expect(SYSTEM_PROMPT).toMatch(/1\/12/);
  });

  it('limits output to what was requested without requiring three metrics', () => {
    expect(SYSTEM_PROMPT).toMatch(/m[áa]ximo 1 p[áa]rrafo/i);
    expect(SYSTEM_PROMPT).toContain('\"metrics\": de 0 a 2');
    expect(SYSTEM_PROMPT).toContain('\"followUps\": de 0 a 2');
    expect(SYSTEM_PROMPT).toContain('CONTRATO CORTO DE CAPTURA');
  });

  it('prioritizes an explicit analysis request even when the same turn adds data', () => {
    expect(SYSTEM_PROMPT).toMatch(/aporta datos y adem[áa]s pide un c[áa]lculo.*usa el contrato de an[áa]lisis/i);
  });

  it('estimates rent instead of asking the user for it', () => {
    expect(SYSTEM_PROMPT).toMatch(/nunca preguntes al usuario por el alquiler/i);
    expect(SYSTEM_PROMPT).toMatch(/provenance.*market/i);
    expect(SYSTEM_PROMPT).not.toMatch(/askField.*alquiler/);
  });

  it('does not ask again for a field already present in the panel context', () => {
    expect(SYSTEM_PROMPT).toMatch(/nunca uses askField para una clave que ya est[ée] presente/i);
  });

  it('captures every explicit field in a multi-value answer without repeating the question', () => {
    expect(SYSTEM_PROMPT).toMatch(/extrae todos los datos expl[íi]citos/i);
    expect(SYSTEM_PROMPT).toMatch(/no repitas la pregunta anterior/i);
    expect(SYSTEM_PROMPT).toMatch(/pregunta por un solo dato/i);
  });

  it('maps the scenario badge phrase to the existing scenario contract', () => {
    expect(SYSTEM_PROMPT).toMatch(/Qué pasa si mueves una palanca/i);
    expect(SYSTEM_PROMPT).toMatch(/2 a 3 escenarios/i);
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

  it('drops blank turns before sending history to the model', () => {
    const msgs = buildMessages(
      [
        { role: 'user', content: 'uno' },
        { role: 'assistant', content: '   ' },
        { role: 'user', content: '' },
      ],
      [],
    );
    expect(msgs.slice(1)).toEqual([{ role: 'user', content: 'uno' }]);
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

describe('buildListingMessages', () => {
  it('sends the listing prompt and the page text as one user turn', () => {
    const [m] = buildListingMessages('{"@type":"Product"}\nProyecto ASPIRIA');
    expect(m!.role).toBe('user');
    expect(m!.content).toContain(LISTING_PROMPT);
    expect(m!.content).toContain('Proyecto ASPIRIA');
  });

  it('asks for the listing shape and tells the model JSON-LD is the most reliable source', () => {
    expect(LISTING_PROMPT).toContain('"modelos"');
    expect(LISTING_PROMPT).toContain('"precioDesde"');
    expect(LISTING_PROMPT).toMatch(/ld\+json|JSON-LD/);
    expect(LISTING_PROMPT).toContain('"dudosos"');
  });
});

describe('renderFields with anuncio provenance', () => {
  it('tells the model a field was read from the listing, not stated by the user', () => {
    const [, fieldsMsg] = buildMessages([], [
      { key: 'precio', label: 'Precio', value: '363,906', prefix: 'S/', provenance: 'anuncio', note: '' },
    ]);
    expect(fieldsMsg!.content).toContain('(anuncio)');
    expect(fieldsMsg!.content).toMatch(/anuncio.*leído del anuncio/i);
  });
});
