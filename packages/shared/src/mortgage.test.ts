import { describe, expect, it } from 'vitest';
import { ExtractionSchema, MortgageFieldSchema, deriveInicial } from './mortgage.ts';

describe('MortgageFieldSchema', () => {
  it('accepts documento provenance', () => {
    const r = MortgageFieldSchema.safeParse({
      key: 'tea', label: 'TEA', value: '8.99', suffix: '%', provenance: 'documento',
    });
    expect(r.success).toBe(true);
  });

  it('rejects a key that is not a mortgage key', () => {
    const r = MortgageFieldSchema.safeParse({
      key: 'alquiler', label: 'Alquiler', value: '1500', provenance: 'documento',
    });
    expect(r.success).toBe(false);
  });

  it('normalises a null note to empty string, like PinnedField does', () => {
    const r = MortgageFieldSchema.parse({
      key: 'cuota', label: 'Cuota', value: '2,506.00', provenance: 'documento', note: null,
    });
    expect(r.note).toBe('');
  });
});

describe('ExtractionSchema', () => {
  it('accepts the shape the model returns, with plazo as a number', () => {
    const r = ExtractionSchema.parse({
      montoFinanciado: '280,000.00', cuota: '2,506.00', tea: '8.990000 %',
      teaTipo: 'fija', tcea: '10.55 %', plazoCuotas: 360,
      seguroDesgravamen: '.048000 %', seguroInmueble: '.029000 %',
      valorInmueble: '618,382.27', totalAPagar: '902,179.33', dudosos: [],
    });
    expect(r.plazoCuotas).toBe(360);
  });

  it('defaults dudosos to an empty array when the model omits it', () => {
    expect(ExtractionSchema.parse({ tea: '6.30 %' }).dudosos).toEqual([]);
  });

  it('accepts nulls for absent fields', () => {
    expect(ExtractionSchema.parse({ tea: null, valorInmueble: null }).tea).toBeNull();
  });
});

describe('deriveInicial', () => {
  it('is the difference between price and financed amount', () => {
    expect(deriveInicial('300,000', '280,000.00')).toBe('20,000');
  });

  it('returns null when either side is missing', () => {
    expect(deriveInicial(undefined, '280,000')).toBeNull();
    expect(deriveInicial('300,000', undefined)).toBeNull();
  });

  it('returns null when the financed amount exceeds the price', () => {
    expect(deriveInicial('250,000', '280,000')).toBeNull();
  });

  it('returns null when either side is not a number', () => {
    expect(deriveInicial('caro', '280,000')).toBeNull();
  });
});
