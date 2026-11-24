import { describe, expect, it } from 'vitest';
import { computeLoan, monthlyRate, parseAmount } from './payment.ts';

const base = { precio: 250000, inicial: 50000, tea: 8, plazoMeses: 240 };

describe('monthlyRate', () => {
  it('compounds the TEA to a monthly rate', () => {
    expect(monthlyRate(8)).toBeCloseTo(0.00643403, 8);
  });

  it('is zero for a zero TEA', () => {
    expect(monthlyRate(0)).toBe(0);
  });
});

describe('computeLoan', () => {
  // Reference values checked independently of this implementation.
  it('matches the reference loan with 50,000 down', () => {
    const r = computeLoan(base)!;
    expect(r.monto).toBe(200000);
    expect(r.tasaMensual).toBeCloseTo(0.00643403, 8);
    expect(r.cuota).toBeCloseTo(1638.30, 2);
    expect(r.intereses).toBeCloseTo(193192.11, 1);
    expect(r.totalPagado).toBeCloseTo(r.cuota * 240, 6);
  });

  it('matches the reference loan with 75,000 down', () => {
    const r = computeLoan({ ...base, inicial: 75000 })!;
    expect(r.cuota).toBeCloseTo(1433.51, 2);
    expect(r.intereses).toBeCloseTo(169043.09, 1);
  });

  it('echoes its inputs', () => {
    const r = computeLoan(base)!;
    expect([r.inicial, r.tea, r.plazoMeses]).toEqual([50000, 8, 240]);
  });

  it('splits the amount evenly at a zero TEA', () => {
    const r = computeLoan({ ...base, tea: 0 })!;
    expect(r.cuota).toBeCloseTo(200000 / 240, 10);
    expect(r.intereses).toBeCloseTo(0, 6);
  });

  it('differs from the wrong TEA/12 method', () => {
    const i = 0.08 / 12;
    const wrong = (200000 * i) / (1 - Math.pow(1 + i, -240));
    expect(computeLoan(base)!.cuota).toBeLessThan(wrong - 30);
  });

  it('amortises the balance to zero over the term', () => {
    const r = computeLoan(base)!;
    let balance = r.monto;
    for (let k = 0; k < r.plazoMeses; k++) balance = balance * (1 + r.tasaMensual) - r.cuota;
    expect(Math.abs(balance)).toBeLessThan(1e-6);
  });

  it.each([
    ['non-finite precio', { precio: NaN }],
    ['infinite tea', { tea: Infinity }],
    ['zero precio', { precio: 0 }],
    ['negative precio', { precio: -1 }],
    ['negative inicial', { inicial: -1 }],
    ['inicial equal to precio', { inicial: 250000 }],
    ['inicial above precio', { inicial: 300000 }],
    ['negative tea', { tea: -1 }],
    ['zero plazo', { plazoMeses: 0 }],
    ['negative plazo', { plazoMeses: -12 }],
    ['fractional plazo', { plazoMeses: 240.5 }],
  ])('returns null for %s', (_, patch) => {
    expect(computeLoan({ ...base, ...patch })).toBeNull();
  });
});

describe('parseAmount', () => {
  it.each([
    [250000, 250000],
    ['250000', 250000],
    ['250,000', 250000],
    ['S/ 250,000', 250000],
    ['S/250.000', 250000],
    ['8.5', 8.5],
    ['1,638.30', 1638.3],
  ])('parses %j', (raw, expected) => {
    expect(parseAmount(raw)).toBe(expected);
  });

  it.each([null, undefined, '', 'S/', 'sin dato', NaN, Infinity])('returns null for %j', (raw) => {
    expect(parseAmount(raw)).toBeNull();
  });
});
