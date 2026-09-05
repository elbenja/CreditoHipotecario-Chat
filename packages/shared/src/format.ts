/**
 * Peruvian house format: `S/ 1,750`.
 * Space after `S/`, comma thousands, dot decimal, never "mil" or "M".
 */

const HOUSE_FORMAT = /^[+-]?S\/ \d{1,3}(,\d{3})*(\.\d{1,2})?$/;

export function formatNumber(n: number): string {
  const abs = Math.abs(n);
  const hasCents = Math.round(abs * 100) % 100 !== 0;
  return abs.toLocaleString('en-US', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

/**
 * Group thousands in a pinned field's value. Field values are bare numbers —
 * the currency marker lives in the field's `prefix` — so this only adds
 * separators, never a `S/`.
 *
 * Deliberately limited to integers >= 1000: grouping every numeric would turn
 * a rate of "7.5" into "7.50" and an area of "55" into something the design
 * never shows. Textual values pass through untouched.
 */
export function groupFieldValue(value: string): string {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return value;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 1000 ? formatNumber(n) : value;
}

export function formatSoles(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}S/ ${formatNumber(n)}`;
}

export function isValidSoles(s: string): boolean {
  return HOUSE_FORMAT.test(s);
}

/**
 * Repair a model-produced amount into house format.
 * Returns null when no number can be recovered.
 */
export function normalizeSoles(s: string): string | null {
  const trimmed = s.trim();
  if (isValidSoles(trimmed)) return trimmed;

  // The sign may sit before or after the currency marker: "-S/ 443", "S/-443".
  const signChar = /^[^\d]*([+-])/.exec(trimmed)?.[1];
  const sign = signChar === '-' ? '-' : signChar === '+' ? '+' : '';

  let body = trimmed.replace(/S\/\.?/gi, '').replace(/[+-]/g, '').trim();
  if (!/\d/.test(body)) return null;
  if (/\b(mil|millones?)\b/i.test(body) || /\d\s*[MK]\b/.test(body)) return null;

  const hasComma = body.includes(',');
  const hasDot = body.includes('.');

  if (hasComma && hasDot) {
    // Both present: the separator appearing LAST is the decimal separator.
    // "1.750,50" is European (1750.50); "1,750.50" is US (also 1750.50).
    const decimal = body.lastIndexOf(',') > body.lastIndexOf('.') ? ',' : '.';
    const thousands = decimal === ',' ? '.' : ',';
    body = body.split(thousands).join('').replace(decimal, '.');
  } else if (hasDot && /\.\d{3}\b/.test(body)) {
    body = body.replace(/\./g, '');
  } else if (hasComma && /,\d{3}\b/.test(body)) {
    body = body.replace(/,/g, '');
  } else if (hasComma) {
    body = body.replace(',', '.');
  }

  const value = Number(body.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(value)) return null;

  return `${sign}S/ ${formatNumber(value)}`;
}
