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

/**
 * A numeric value must match a WHOLE number the user wrote — never a substring.
 * Without this, a plazo of "50" matches the "50" inside "250,000" and an
 * assumed value renders as fact, which the design treats as a bug.
 */
function appearsIn(value: string, text: string, numbers: Set<string>): boolean {
  if (!value.trim()) return false;

  if (/^[\d.,]+$/.test(value)) {
    return numbers.has(normalizeNumber(value));
  }

  // Textual values (a district name) compare loosely on punctuation.
  const loose = (s: string) => normalizeText(s).replace(/[.,\s]/g, '');
  return loose(text).includes(loose(value));
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
