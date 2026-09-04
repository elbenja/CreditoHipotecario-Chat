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

/** Spanish scale words that follow a number: "250 mil" means 250,000. */
const MULTIPLIERS: [RegExp, number][] = [
  [/^millones?$/, 1_000_000],
  [/^mil$/, 1_000],
];

/**
 * Every standalone number the user wrote, in canonical form — including the
 * scaled value when a Spanish scale word follows, so "250 mil" also records
 * 250000 and matches a model that normalised it to "250,000".
 */
function numbersIn(text: string): Set<string> {
  const out = new Set<string>();
  const tokens = text.match(/\d[\d.,]*|[a-zñ]+/gi) ?? [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (!/^\d/.test(token)) continue;

    const base = normalizeNumber(token.replace(/[.,]+$/, ''));
    out.add(base);

    const next = tokens[i + 1]?.toLowerCase();
    if (!next) continue;
    for (const [pattern, multiplier] of MULTIPLIERS) {
      if (!pattern.test(next)) continue;
      const scaled = Number(base) * multiplier;
      if (Number.isFinite(scaled)) out.add(normalizeNumber(String(scaled)));
    }
  }

  return out;
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

  const haystack = words(text);
  // The model often expands what the user said ("Pueblo Libre" -> "Pueblo
  // Libre, Lima"), so also try the first comma-segment. FIRST segment only:
  // trying every segment would let "Ate, Lima" match a user who said only
  // "Lima", marking an unstated district as user-stated.
  for (const candidate of [value, value.split(',')[0] ?? '']) {
    const needle = words(candidate);
    if (!needle) continue;
    if (new RegExp(`(?<![\\p{L}\\p{N}])${needle}(?![\\p{L}\\p{N}])`, 'u').test(haystack)) {
      return true;
    }
  }
  return false;
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
