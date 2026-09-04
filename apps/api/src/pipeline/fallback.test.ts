import { describe, expect, it } from 'vitest';
import { extractCandidates } from './fallback';

describe('extractCandidates', () => {
  it('extracts a down payment percentage', () => {
    const out = extractCandidates('Con 30% de inicial la cuota baja.');
    expect(out).toContainEqual({ key: 'inicial', label: 'Cuota inicial', value: '30' });
  });

  it('extracts a soles amount as the price', () => {
    const out = extractCandidates('El depa cuesta S/ 250,000 en total.');
    expect(out).toContainEqual({ key: 'precio', label: 'Precio de compra', value: '250,000' });
  });

  it('extracts a TEA rate', () => {
    const out = extractCandidates('Con una TEA de 7.24% mejoras el flujo.');
    expect(out).toContainEqual({ key: 'tasa', label: 'Tasa TEA', value: '7.24' });
  });

  it('extracts a term in years', () => {
    const out = extractCandidates('Si estiras a 25 años pagas más interés.');
    expect(out).toContainEqual({ key: 'plazo', label: 'Plazo', value: '25' });
  });

  it('extracts an area in square metres', () => {
    const out = extractCandidates('Un depa de 40 m² en Pueblo Libre.');
    expect(out).toContainEqual({ key: 'area', label: 'Área', value: '40' });
  });

  it('returns an empty array when nothing matches', () => {
    expect(extractCandidates('No sé qué decirte.')).toEqual([]);
  });

  it('does not emit duplicate keys', () => {
    const out = extractCandidates('30% de inicial, o quizá 20% de inicial.');
    const inicial = out.filter((c) => c.key === 'inicial');
    expect(inicial).toHaveLength(1);
  });

  it('prefers TEA over a bare percentage for the rate', () => {
    const out = extractCandidates('TEA de 8.0% y 30% de inicial.');
    expect(out).toContainEqual({ key: 'tasa', label: 'Tasa TEA', value: '8.0' });
    expect(out).toContainEqual({ key: 'inicial', label: 'Cuota inicial', value: '30' });
  });

  it('does not offer a monthly payment as the purchase price', () => {
    const out = extractCandidates('Con 30% de inicial la cuota baja a S/ 1,434 en 25 años, 40 m².');
    expect(out.some((c) => c.key === 'precio')).toBe(false);
  });

  it('still extracts the other fields from that same sentence', () => {
    const out = extractCandidates('Con 30% de inicial la cuota baja a S/ 1,434 en 25 años, 40 m².');
    expect(out).toContainEqual({ key: 'inicial', label: 'Cuota inicial', value: '30' });
    expect(out).toContainEqual({ key: 'plazo', label: 'Plazo', value: '25' });
    expect(out).toContainEqual({ key: 'area', label: 'Área', value: '40' });
  });

  it('extracts a price cued by the word precio', () => {
    const out = extractCandidates('El precio es de S/ 250,000.');
    expect(out).toContainEqual({ key: 'precio', label: 'Precio de compra', value: '250,000' });
  });

  it('extracts a price cued by the word piden', () => {
    const out = extractCandidates('Piden S/ 320,000 por el depa.');
    expect(out).toContainEqual({ key: 'precio', label: 'Precio de compra', value: '320,000' });
  });

  it('returns nothing for a bare cuota sentence', () => {
    expect(extractCandidates('La cuota es S/ 1,434.')).toEqual([]);
  });
});
