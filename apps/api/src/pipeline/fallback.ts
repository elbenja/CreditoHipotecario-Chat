import type { FieldKey } from '@chat/shared';
import { COPY, type Lang } from '../i18n.ts';

export interface Candidate {
  key: FieldKey;
  label: string;
  value: string;
}

interface Rule {
  key: FieldKey;
  pattern: RegExp;
}

/**
 * Order matters: the first rule to claim a key wins, so more specific
 * patterns (TEA) must precede looser ones (a bare percentage).
 */
const RULES: Rule[] = [
  { key: 'tasa', pattern: /\bTEA\b[^\d%]{0,15}(\d{1,2}(?:\.\d{1,2})?)\s*%/i },
  { key: 'inicial', pattern: /(\d{1,2})\s*%\s*(?:de\s+inicial|down\b)/i },
  { key: 'plazo', pattern: /(\d{1,2})\s*(?:a[ñn]os|years)/i },
  { key: 'area', pattern: /(\d{1,4})\s*m(?:2|²)/i },
  {
    key: 'precio',
    // Must be cued by purchase vocabulary. Without this, "la cuota baja a
    // S/ 1,434" is offered as a purchase price and the user pins nonsense.
    // Fails safe: an uncued amount yields no chip rather than a wrong one.
    pattern:
      /(?:precio|cuesta|cuestan|vale|valen|compra|piden|depa de|departamento de|price|costs?|asking|apartment for)[^.]{0,30}?S\/\.?\s*(\d{1,3}(?:,\d{3})+|\d{5,})/i,
  },
];

export function extractCandidates(prose: string, lang: Lang = 'es'): Candidate[] {
  const seen = new Set<FieldKey>();
  const out: Candidate[] = [];

  for (const rule of RULES) {
    if (seen.has(rule.key)) continue;
    const m = rule.pattern.exec(prose);
    if (!m || !m[1]) continue;
    seen.add(rule.key);
    out.push({ key: rule.key, label: COPY[lang].fieldLabels[rule.key], value: m[1] });
  }

  return out;
}
