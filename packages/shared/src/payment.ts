/**
 * Mortgage payment, Peruvian conventions:
 * - Banks quote TEA (effective annual rate). Monthly rate = (1 + TEA)^(1/12) - 1, never TEA / 12.
 * - Cuota is the fixed-rate annuity on the financed amount, paid in arrears:
 *   cuota = monto * i / (1 - (1 + i)^-n).
 * - Excludes insurance (desgravamen, inmueble) and fees, so it is not the TCEA cuota.
 * - Results are unrounded; callers round only for display.
 */

export interface LoanInput {
  precio: number;
  inicial: number;
  /** Percent, e.g. 8 for 8%. */
  tea: number;
  plazoMeses: number;
}

export interface LoanResult {
  monto: number;
  inicial: number;
  tea: number;
  plazoMeses: number;
  /** As a fraction, e.g. 0.006434. */
  tasaMensual: number;
  cuota: number;
  totalPagado: number;
  intereses: number;
}

/** Monthly rate as a fraction from a TEA given in percent. */
export function monthlyRate(teaPercent: number): number {
  return Math.pow(1 + teaPercent / 100, 1 / 12) - 1;
}

/** Null when the inputs do not describe a loan. */
export function computeLoan(input: LoanInput): LoanResult | null {
  const { precio, inicial, tea, plazoMeses } = input;
  if (![precio, inicial, tea, plazoMeses].every(Number.isFinite)) return null;
  if (precio <= 0 || inicial < 0 || inicial >= precio || tea < 0) return null;
  if (!Number.isInteger(plazoMeses) || plazoMeses <= 0) return null;

  const monto = precio - inicial;
  const tasaMensual = monthlyRate(tea);
  const cuota = tasaMensual === 0
    ? monto / plazoMeses
    : (monto * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -plazoMeses));
  const totalPagado = cuota * plazoMeses;
  return {
    monto, inicial, tea, plazoMeses, tasaMensual, cuota, totalPagado,
    intereses: totalPagado - monto,
  };
}

/** Parse a written amount ("S/ 250,000", "S/250.000", "1,638.30"); null when there is no number. */
export function parseAmount(raw: string | number | null | undefined): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (!raw) return null;
  const bare = raw.replace(/S\/\.?/gi, '').replace(/[^\d.,-]/g, '').trim();
  if (!bare) return null;
  // Strip thousands separators, then treat any remaining comma as a decimal point.
  const n = Number(bare.replace(/[.,](?=\d{3}(?!\d))/g, '').replace(/,/g, '.'));
  return Number.isFinite(n) ? n : null;
}
