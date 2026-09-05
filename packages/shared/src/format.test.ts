import { describe, expect, it } from 'vitest';
import {
  formatNumber,
  formatSoles,
  groupFieldValue,
  isValidSoles,
  normalizeSoles,
} from './format.ts';

describe('formatSoles', () => {
  it('formats with a space and comma thousands', () => {
    expect(formatSoles(1750)).toBe('S/ 1,750');
  });

  it('formats a six-figure amount', () => {
    expect(formatSoles(250000)).toBe('S/ 250,000');
  });

  it('drops trailing decimals when whole', () => {
    expect(formatSoles(1843.0)).toBe('S/ 1,843');
  });

  it('keeps two decimals when present', () => {
    expect(formatSoles(1843.09)).toBe('S/ 1,843.09');
  });

  it('signs negatives before the currency', () => {
    expect(formatSoles(-443)).toBe('-S/ 443');
  });
});

describe('formatNumber', () => {
  it('formats without a currency prefix', () => {
    expect(formatNumber(250000)).toBe('250,000');
  });
});

describe('isValidSoles', () => {
  it('accepts house format', () => {
    expect(isValidSoles('S/ 1,750')).toBe(true);
  });

  it('rejects a missing space', () => {
    expect(isValidSoles('S/1,750')).toBe(false);
  });

  it('rejects the word mil', () => {
    expect(isValidSoles('1.75 mil')).toBe(false);
  });

  it('rejects an M suffix', () => {
    expect(isValidSoles('S/ 1.7M')).toBe(false);
  });
});

describe('normalizeSoles', () => {
  it('repairs a missing space', () => {
    expect(normalizeSoles('S/1,750')).toBe('S/ 1,750');
  });

  it('repairs a bare number', () => {
    expect(normalizeSoles('1750')).toBe('S/ 1,750');
  });

  it('repairs European separators', () => {
    expect(normalizeSoles('S/ 1.750')).toBe('S/ 1,750');
  });

  it('preserves a leading sign', () => {
    expect(normalizeSoles('+250')).toBe('+S/ 250');
  });

  it('returns null for unrecoverable input', () => {
    expect(normalizeSoles('un poco más')).toBeNull();
  });

  it('reads the last separator as the decimal point (European)', () => {
    expect(normalizeSoles('1.750,50')).toBe('S/ 1,750.50');
  });

  it('reads the last separator as the decimal point (US)', () => {
    expect(normalizeSoles('1,750.50')).toBe('S/ 1,750.50');
  });

  it('keeps a sign that follows the currency marker', () => {
    expect(normalizeSoles('S/-443')).toBe('-S/ 443');
  });

  it('handles repeated thousands separators', () => {
    expect(normalizeSoles('1.234.567,89')).toBe('S/ 1,234,567.89');
  });
});

describe('groupFieldValue', () => {
  it('groups a six-figure price', () => {
    expect(groupFieldValue('300000')).toBe('300,000');
  });

  it('groups a four-figure rent', () => {
    expect(groupFieldValue('2000')).toBe('2,000');
  });

  it('leaves a rate alone', () => {
    expect(groupFieldValue('7.5')).toBe('7.5');
  });

  it('leaves a small integer alone', () => {
    expect(groupFieldValue('55')).toBe('55');
  });

  it('leaves an already-grouped value alone', () => {
    expect(groupFieldValue('250,000')).toBe('250,000');
  });

  it('leaves a textual value alone', () => {
    expect(groupFieldValue('Pueblo Libre, Lima')).toBe('Pueblo Libre, Lima');
  });
});
