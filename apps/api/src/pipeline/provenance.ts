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
    .replace(/[ \u00A0\u202F]/g, '') // spaces used as thousands separators
    .replace(/[.,](?=\d{3}(?!\d))/g, '') // thousands separators
    .replace(/,/g, '.') // any remaining comma is a decimal point
    .replace(/\.0+$/, ''); // 8.0 -> 8
}

/** Collapse to letters, digits and single spaces so word boundaries are meaningful. */
function words(s: string): string {
  return normalizeText(s)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** A negator close before a number or name means the user was ruling it out. */
const NEGATOR = /\b(no|ni|tampoco|nunca)\b/;

interface NumberMention {
  value: string;
  before: string;
  after: string;
}

/**
 * Every number the user wrote, WITH the text around it. The context is the
 * point: a bare set of numbers cannot tell whether "20" was said about the
 * term or the down payment.
 */
function numberMentions(text: string): NumberMention[] {
  const out: NumberMention[] = [];
  const re = /\d(?:[\d.,]|[ \u00A0\u202F](?=\d{3}\b))*/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    const raw = m[0].replace(/[.,]+$/, '');
    if (!raw) continue;
    const end = m.index + m[0].length;
    const before = text.slice(Math.max(0, m.index - 24), m.index);
    const after = text.slice(end, end + 18);

    const base = normalizeNumber(raw);
    out.push({ value: base, before, after });

    // "250 mil" also means 250000.
    const scale = /^\s*(millones?|mil)\b/i.exec(after);
    if (scale) {
      const multiplier = /millon/i.test(scale[1]!) ? 1_000_000 : 1_000;
      const scaled = Number(base) * multiplier;
      if (Number.isFinite(scaled)) {
        out.push({ value: normalizeNumber(String(scaled)), before, after });
      }
    }
  }

  return out;
}

/**
 * What the surrounding text must contain for a number to count as evidence for
 * a given field. Without this, any number the user wrote validates any field.
 */
const CUE: Record<string, RegExp> = {
  precio:
    /s\/|soles|dolares|precio|cuesta|cuestan|vale|valen|compra|piden|depa de|casa de|departamento de|dpto de|mil|millon/,
  area: /m2|m²|metros|area/,
  tasa: /%|por ciento|tea|tasa|interes/,
  inicial: /%|por ciento|inicial|adelanto|enganche/,
  plazo: /a[nñ]os?|plazo|cuotas/,
  alquiler: /alquil|renta|arriendo|s\/|soles|mes/,
};

function numericMatch(key: string, needle: string, mentions: NumberMention[]): boolean {
  const cue = CUE[key];
  if (!cue) return false;

  return mentions.some((mention) => {
    if (mention.value !== needle) return false;
    if (!cue.test(normalizeText(`${mention.before} ${mention.after}`))) return false;
    // "No tengo 250 mil" is not a claim that the price is 250 mil.
    return !NEGATOR.test(normalizeText(mention.before).slice(-20));
  });
}

function textualMatch(value: string, text: string): boolean {
  const haystack = words(text);
  // The model often expands what the user said ("Pueblo Libre" -> "Pueblo
  // Libre, Lima"), so also try the first comma-segment. FIRST segment only:
  // trying every segment would let "Ate, Lima" match a user who said only
  // "Lima", marking an unstated district as user-stated.
  for (const candidate of [value, value.split(',')[0] ?? '']) {
    const needle = words(candidate);
    if (!needle) continue;
    const hit = new RegExp(`(?<![\\p{L}\\p{N}])${needle}(?![\\p{L}\\p{N}])`, 'u').exec(haystack);
    if (!hit) continue;
    if (NEGATOR.test(haystack.slice(Math.max(0, hit.index - 20), hit.index))) continue;
    return true;
  }
  return false;
}

/**
 * A numeric value must match a whole number the user wrote ABOUT THIS FIELD;
 * a textual value must match on word boundaries. Neither counts when the user
 * was negating it.
 */
function appearsIn(
  key: string,
  value: string,
  text: string,
  mentions: NumberMention[],
): boolean {
  if (!value.trim()) return false;

  // A model may fold a currency marker into the value itself; strip before testing.
  const bare = value.replace(/S\/\.?/gi, '').replace(/[$€]/g, '').trim();
  if (/^[\d., \u00A0\u202F]+$/.test(bare)) {
    return numericMatch(key, normalizeNumber(bare), mentions);
  }
  return textualMatch(value, text);
}

/**
 * Downgrade any field claiming `user` provenance whose value the user never
 * actually stated. Never upgrades — the model does not get to promote a guess.
 */
export function enforceProvenance(fields: PinnedField[], userTurns: string[]): PinnedField[] {
  const text = userTurns.join(' ');
  const mentions = numberMentions(text);

  return fields.map((f) => {
    // Only the document and listing pipelines ever mint 'documento' or
    // 'anuncio' — the chat model never reads a page or a document, so a
    // field claiming either here is the model forging where it came from.
    if (f.provenance === 'documento' || f.provenance === 'anuncio') return { ...f, provenance: 'assumed' as const };
    if (f.provenance !== 'user') return f;
    return appearsIn(f.key, f.value, text, mentions) ? f : { ...f, provenance: 'assumed' as const };
  });
}
