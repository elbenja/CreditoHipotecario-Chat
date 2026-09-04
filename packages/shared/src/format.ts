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

  const signMatch = /^([+-])/.exec(trimmed);
  const sign = signMatch ? signMatch[1] : '';

  // Strip sign, currency marker and whitespace; keep digits and separators.
  let body = trimmed.replace(/^[+-]/, '').replace(/S\/\.?/gi, '').trim();
  if (!/\d/.test(body)) return null;
  if (/\b(mil|millones?)\b/i.test(body) || /\d\s*[MK]\b/.test(body)) return null;

  // Disambiguate separators. A dot used as a thousands separator always has
  // exactly three digits after it and no other decimal marker present.
  const hasComma = body.includes(',');
  const hasDot = body.includes('.');
  if (hasDot && !hasComma && /\.\d{3}\b/.test(body)) {
    body = body.replace(/\./g, '');
  } else if (hasComma && hasDot) {
    body = body.replace(/,/g, '');
  } else if (hasComma && /,\d{3}\b/.test(body)) {
    body = body.replace(/,/g, '');
  } else if (hasComma) {
    body = body.replace(',', '.');
  }

  const value = Number(body.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(value)) return null;

  return `${sign}S/ ${formatNumber(value)}`;
}
