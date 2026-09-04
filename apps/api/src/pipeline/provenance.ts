import type { PinnedField } from '@chat/shared';

/** Lowercase and strip accents, keeping digits and separators intact. */
function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Canonical form of a written number, so "250,000", "250.000" and "250000"
 * compare equal, and "8.0" equals "8".
 */
function normalizeNumber(s: string): string {
  return s
    .replace(/[.,](?=\d{3}(?!\d))/g, '') // thousands separators
    .replace(/,/g, '.') // any remaining comma is a decimal point
    .replace(/\.0+$/, ''); // 8.0 -> 8
}

/** Every standalone number the user wrote, in canonical form. */
function numbersIn(text: string): Set<string> {
  const runs = text.match(/\d[\d.,]*/g) ?? [];
  return new Set(runs.map((r) => normalizeNumber(r.replace(/[.,]+$/, ''))));
}

/** Collapse to letters, digits and single spaces so word boundaries are meaningful. */
function words(s: string): string {
  return normalizeText(s)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * A numeric value must match a WHOLE number the user wrote, and a textual value
 * must match on word boundaries. Without the latter, the district "Ate" matches
 * inside "atender" and an assumed location renders as fact.
 */
function appearsIn(value: string, text: string, numbers: Set<string>): boolean {
  if (!value.trim()) return false;

  // A model may fold a currency marker into the value itself; strip before testing.
  const bare = value.replace(/S\/\.?/gi, '').replace(/[$€]/g, '').trim();
  if (/^[\d.,]+$/.test(bare)) {
    return numbers.has(normalizeNumber(bare));
  }

  const needle = words(value);
  if (!needle) return false;
  return new RegExp(`(?<![\\p{L}\\p{N}])${needle}(?![\\p{L}\\p{N}])`, 'u').test(words(text));
}

/**
 * Downgrade any field claiming `user` provenance whose value the user never
 * actually stated. Never upgrades — the model does not get to promote a guess.
 */
export function enforceProvenance(fields: PinnedField[], userTurns: string[]): PinnedField[] {
  const text = normalizeText(userTurns.join(' '));
  const numbers = numbersIn(text);

  return fields.map((f) => {
    if (f.provenance !== 'user') return f;
    return appearsIn(f.value, text, numbers) ? f : { ...f, provenance: 'assumed' as const };
  });
}
