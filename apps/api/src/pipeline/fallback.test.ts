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
});
