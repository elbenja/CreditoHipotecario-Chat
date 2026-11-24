import { computeLoan, formatSoles, parseAmount, type LoanResult } from '@chat/shared';
import { z } from 'zod';

/**
 * The model does not do mortgage arithmetic. It declares what to compute in
 * "calculos" and writes {{id.figure}} where a number goes; this module runs
 * the tested function and fills the markers in. Measured before this existed:
 * the model's own payment for S/ 200,000 at 8% TEA over 20 years was S/ 1,673
 * against a correct S/ 1,638.
 *
 * Display rounding: every amount is rounded half-up to the whole sol, and a
 * difference is the difference of the two ROUNDED amounts, so the cards on
 * screen always subtract to the delta shown beside them.
 */

const Num = z.union([z.number(), z.string()]).nullish();

const CalcSchema = z.object({
  id: z.string().trim().regex(/^[a-z][a-z0-9_]*$/i),
  precio: Num,
  inicial: Num,
  inicialPct: Num,
  tea: Num,
  plazoAnios: Num,
  plazoMeses: Num,
});

const MARKER = /\{\{\s*([a-z][a-z0-9_]*)\.([a-z]+)\s*\}\}/gi;

function toLoan(calc: z.infer<typeof CalcSchema>): LoanResult | null {
  const precio = parseAmount(calc.precio);
  const tea = parseAmount(calc.tea);
  const pct = parseAmount(calc.inicialPct);
  const inicial = parseAmount(calc.inicial) ?? (precio !== null && pct !== null ? (precio * pct) / 100 : null);
  const years = parseAmount(calc.plazoAnios);
  const plazoMeses = parseAmount(calc.plazoMeses) ?? (years !== null ? Math.round(years * 12) : null);
  if (precio === null || tea === null || inicial === null || plazoMeses === null) return null;
  return computeLoan({ precio, inicial, tea, plazoMeses });
}

const soles = (n: number) => formatSoles(Math.round(n));

function figure(loan: LoanResult, base: LoanResult, name: string): string | null {
  const diff = (pick: (l: LoanResult) => number) => Math.round(pick(loan)) - Math.round(pick(base));
  const cuota = diff((l) => l.cuota);
  const key = name.toLowerCase();
  // A comparison of the base with itself is always zero, and reads as a
  // result ("drops by S/ 0"). Refuse it so the turn is asked again.
  if (loan === base && /^(dif|delta|cambio)/.test(key)) return null;
  switch (key) {
    case 'cuota': return soles(loan.cuota);
    case 'monto': return soles(loan.monto);
    case 'inicial': return soles(loan.inicial);
    case 'intereses': return soles(loan.intereses);
    case 'total': return soles(loan.totalPagado);
    // The inputs, echoed: the model reaches for these in a "context" line.
    case 'precio': return soles(loan.monto + loan.inicial);
    case 'tea': return `${loan.tea}%`;
    case 'plazoanios': return String(Math.round((loan.plazoMeses / 12) * 10) / 10);
    case 'plazomeses': return String(loan.plazoMeses);
    case 'tasamensual': return `${(loan.tasaMensual * 100).toFixed(3)}%`;
    case 'difcuota': return formatSoles(Math.abs(cuota));
    case 'difintereses': return formatSoles(Math.abs(diff((l) => l.intereses)));
    case 'difinicial': return formatSoles(Math.abs(diff((l) => l.inicial)));
    case 'deltacuota': return `${cuota < 0 ? '↓' : cuota > 0 ? '↑' : '='} ${formatSoles(Math.abs(cuota))}`;
    case 'cambiocuota': return `${cuota > 0 ? '+' : ''}${formatSoles(cuota)}`;
    default: return null;
  }
}

/** Every string in the value, markers replaced. Throws on one it cannot fill. */
function fill(value: unknown, loans: Map<string, LoanResult>, base: LoanResult | undefined): unknown {
  if (typeof value === 'string') {
    return value
      .replace(MARKER, (_m, id: string, name: string) => {
        const loan = loans.get(id.toLowerCase());
        const text = loan && base ? figure(loan, base, name) : null;
        if (text === null) throw new Error(`unfillable marker ${id}.${name}`);
        return text;
      })
      // The markers carry their own "S/"; the model sometimes writes one too.
      .replace(/S\/\.?\s*(?=[+-]?S\/ )/g, '');
  }
  if (Array.isArray(value)) return value.map((v) => fill(v, loans, base));
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fill(v, loans, base)]));
  }
  return value;
}

const LITERAL = /S\/\.?\s*(\d[\d.,]*)/g;
const NUMBER = /\d[\d.,]*/g;

/** The strings a reader takes as results: the headline, the cards, the paragraph. */
function resultTexts(reply: Record<string, unknown>): string[] {
  const list = (v: unknown) => (Array.isArray(v) ? v : []);
  const texts: unknown[] = [reply.verdict, ...list(reply.prose)];
  for (const m of list(reply.metrics)) texts.push(m?.value, m?.delta);
  for (const sc of list(reply.scenarios)) texts.push(sc?.value);
  return texts.filter((t): t is string => typeof t === 'string');
}

/**
 * Soles amounts the model typed itself, in a reply that also declared
 * calculations, that match nothing the system computed and nothing the user
 * or the fields said. Seen live: "drops by S/ 410" beside a computed delta of
 * S/ 204. An amount of something else (a rent, an insurance range) lands here
 * too, so this is a reason to ask again, never a reason to refuse an answer.
 */
function unverifiedAmounts(reply: Record<string, unknown>, loans: LoanResult[], userTurns: string[]): string[] {
  const known = new Set<number>();
  const add = (n: number | null) => { if (n !== null) known.add(Math.round(n)); };
  const sides = (l: LoanResult) => [l.monto + l.inicial, l.inicial, l.monto, l.cuota, l.intereses, l.totalPagado].map(Math.round);
  for (const a of loans) {
    sides(a).forEach(add);
    for (const b of loans) sides(a).forEach((v, i) => add(Math.abs(v - sides(b)[i]!)));
  }
  for (const turn of userTurns) for (const n of turn.match(NUMBER) ?? []) add(parseAmount(n));
  for (const f of Array.isArray(reply.fields) ? reply.fields : []) add(parseAmount(f?.value));

  const out: string[] = [];
  for (const text of resultTexts(reply)) {
    for (const m of text.matchAll(LITERAL)) {
      const n = parseAmount(m[1]);
      if (n !== null && !known.has(Math.round(n))) out.push(m[0].replace(/[.,]+$/, ''));
    }
  }
  return out;
}

export type CalcOutcome = { ok: true; value: unknown; unverified: string[] } | { ok: false };

/**
 * Run the declared calculations and fill their markers throughout the reply.
 * Fails as a whole when a calculation is invalid or a marker has nothing to
 * stand for: a half-filled answer would show a wrong or missing number as if
 * it were a result.
 */
export function applyCalcs(parsed: unknown, userTurns: string[] = []): CalcOutcome {
  if (typeof parsed !== 'object' || parsed === null) return { ok: true, value: parsed, unverified: [] };
  const { calculos, ...rest } = parsed as Record<string, unknown>;

  const loans = new Map<string, LoanResult>();
  let base: LoanResult | undefined;
  for (const raw of Array.isArray(calculos) ? calculos : []) {
    const calc = CalcSchema.safeParse(raw);
    const loan = calc.success ? toLoan(calc.data) : null;
    if (!calc.success || !loan) return { ok: false };
    loans.set(calc.data.id.toLowerCase(), loan);
    base ??= loan;
  }

  try {
    return {
      ok: true,
      value: fill(rest, loans, base),
      // Read before filling: only what the model typed is in question.
      unverified: loans.size > 0 ? unverifiedAmounts(rest, [...loans.values()], userTurns) : [],
    };
  } catch {
    return { ok: false };
  }
}
