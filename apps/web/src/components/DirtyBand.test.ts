import type { PinnedField } from '@chat/shared';
import { describe, expect, it } from 'vitest';
import { describeDirty } from './DirtyBand';

const fields: Record<string, PinnedField> = {
  tasa: { key: 'tasa', label: 'Tasa TEA', value: '8', provenance: 'user', note: '' },
  inicial: { key: 'inicial', label: 'Cuota inicial', value: '20', provenance: 'assumed', note: '' },
  plazo: { key: 'plazo', label: 'Plazo', value: '20', provenance: 'assumed', note: '' },
};

describe('describeDirty', () => {
  it('names a single changed field', () => {
    expect(describeDirty(fields, ['tasa'])).toBe(
      'Cambiaste la tasa. Los números de arriba son de antes.',
    );
  });

  it('joins two changed fields with y', () => {
    expect(describeDirty(fields, ['tasa', 'inicial'])).toBe(
      'Cambiaste la tasa y la cuota inicial. Los números de arriba son de antes.',
    );
  });

  it('uses commas and a final y for three', () => {
    expect(describeDirty(fields, ['tasa', 'inicial', 'plazo'])).toBe(
      'Cambiaste la tasa, la cuota inicial y el plazo. Los números de arriba son de antes.',
    );
  });

  it('returns an empty string when nothing is dirty', () => {
    expect(describeDirty(fields, [])).toBe('');
  });

  it('ignores a key with no matching field', () => {
    expect(describeDirty(fields, ['tasa', 'fantasma'])).toBe(
      'Cambiaste la tasa. Los números de arriba son de antes.',
    );
  });
});
