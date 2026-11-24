import type { PinnedField, Scenario } from '@chat/shared';
import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { es } from '../i18n/es';
import { demoStep } from './demoStep';

const user = (content: string) => ({ id: content, role: 'user' as const, content });
const pinned = (key: string) => ({ key, label: key, value: '1', provenance: 'user', note: '' }) as PinnedField;
const [one, two, three] = es.demo.steps.map((s) => s.prompt!);

function at(messages: string[], extra: { fields?: string[]; saved?: number } = {}) {
  return demoStep({
    messages: messages.map(user),
    fields: Object.fromEntries((extra.fields ?? []).map((k) => [k, pinned(k)])),
    savedScenarios: Array.from({ length: extra.saved ?? 0 }, () => ({}) as Scenario),
  });
}

describe('demoStep', () => {
  it('starts at step 1', () => {
    expect(at([])).toBe(1);
  });

  it('moves on as each prompt is sent', () => {
    expect(at([one!])).toBe(2);
    expect(at([one!, two!])).toBe(3);
    expect(at([one!, two!, three!])).toBe(4);
  });

  it('counts a prompt sent in the other language', () => {
    expect(at([en.demo.steps[0]!.prompt!])).toBe(2);
  });

  it('ignores the reader own messages', () => {
    expect(at(['¿Y en Surco?'])).toBe(1);
  });

  it('treats step 2 as done once rate and term are pinned', () => {
    expect(at([one!], { fields: ['tasa'] })).toBe(2);
    expect(at([one!], { fields: ['tasa', 'plazo'] })).toBe(3);
  });

  it('finishes once a scenario is saved', () => {
    expect(at([one!, two!, three!], { saved: 1 })).toBe(5);
  });

  it('stays on the first step not done, even with later ones done', () => {
    expect(at([one!, three!], { saved: 1 })).toBe(2);
  });
});
