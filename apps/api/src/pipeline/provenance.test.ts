import type { PinnedField } from '@chat/shared';
import { describe, expect, it } from 'vitest';
import { enforceProvenance } from './provenance.ts';

function field(over: Partial<PinnedField> = {}): PinnedField {
  return {
    key: 'precio',
    label: 'Precio de compra',
    value: '250,000',
    provenance: 'user',
    note: '',
    ...over,
  };
}

describe('enforceProvenance', () => {
  it('keeps user provenance when the value appears in a user turn', () => {
    const turns = ['Depa de 250,000 en Pueblo Libre'];
    expect(enforceProvenance([field()], turns)[0]!.provenance).toBe('user');
  });

  it('matches a value written without thousands separators', () => {
    const turns = ['Depa de 250000 soles'];
    expect(enforceProvenance([field()], turns)[0]!.provenance).toBe('user');
  });

  it('matches a value written with dot separators', () => {
    const turns = ['Cuesta 250.000'];
    expect(enforceProvenance([field()], turns)[0]!.provenance).toBe('user');
  });

  it('downgrades to assumed when the value is absent', () => {
    const turns = ['Un depa en Pueblo Libre'];
    expect(enforceProvenance([field()], turns)[0]!.provenance).toBe('assumed');
  });

  it('downgrades a model-claimed user value the user never stated', () => {
    const turns = ['Depa de 250,000'];
    const inicial = field({ key: 'inicial', value: '10', provenance: 'user' });
    expect(enforceProvenance([inicial], turns)[0]!.provenance).toBe('assumed');
  });

  it('never upgrades an assumed field even when the value matches', () => {
    const turns = ['Depa de 250,000'];
    const f = field({ provenance: 'assumed' });
    expect(enforceProvenance([f], turns)[0]!.provenance).toBe('assumed');
  });

  it('leaves market provenance untouched', () => {
    const f = field({ provenance: 'market' });
    expect(enforceProvenance([f], [])[0]!.provenance).toBe('market');
  });

  it('matches a textual value case-insensitively', () => {
    const turns = ['queda en pueblo libre, lima'];
    const f = field({ key: 'ubicacion', value: 'Pueblo Libre, Lima' });
    expect(enforceProvenance([f], turns)[0]!.provenance).toBe('user');
  });

  it('matches a decimal rate written without the trailing zero', () => {
    const turns = ['la tasa es 8%'];
    const f = field({ key: 'tasa', value: '8.0' });
    expect(enforceProvenance([f], turns)[0]!.provenance).toBe('user');
  });

  // Guards the core promise: an assumed value must never render as fact.
  it('does not match a short number buried inside a longer one', () => {
    const turns = ['Depa de 250,000 en Pueblo Libre'];
    const plazo = field({ key: 'plazo', value: '50', provenance: 'user' });
    expect(enforceProvenance([plazo], turns)[0]!.provenance).toBe('assumed');
  });

  it('does not match a term the user never gave', () => {
    const turns = ['Cuesta 250,000 y mide 40 m²'];
    const plazo = field({ key: 'plazo', value: '20', provenance: 'user' });
    expect(enforceProvenance([plazo], turns)[0]!.provenance).toBe('assumed');
  });

  it('matches a standalone number the user did give', () => {
    const turns = ['Cuesta 250,000 y lo quiero a 20 años'];
    const plazo = field({ key: 'plazo', value: '20', provenance: 'user' });
    expect(enforceProvenance([plazo], turns)[0]!.provenance).toBe('user');
  });

  // "Ate" is a real Lima district and a substring of "atender".
  it('does not match a district name buried inside another word', () => {
    const f = field({ key: 'ubicacion', value: 'Ate' });
    expect(enforceProvenance([f], ['Quiero atender esto rápido'])[0]!.provenance).toBe('assumed');
  });

  it('matches a district the user actually named', () => {
    const f = field({ key: 'ubicacion', value: 'Ate' });
    expect(enforceProvenance([f], ['Un depa en Ate, Lima'])[0]!.provenance).toBe('user');
  });

  it('does not match a district inside an unrelated longer word', () => {
    const f = field({ key: 'ubicacion', value: 'Surco' });
    expect(enforceProvenance([f], ['El terreno esta surcado'])[0]!.provenance).toBe('assumed');
  });

  it('matches a numeric value carrying a foreign currency symbol', () => {
    const f = field({ value: '$250,000' });
    expect(enforceProvenance([f], ['Depa de 250,000 soles'])[0]!.provenance).toBe('user');
  });

  it('matches a numeric value carrying the soles marker', () => {
    const f = field({ value: 'S/ 250,000' });
    expect(enforceProvenance([f], ['Depa de 250,000 soles'])[0]!.provenance).toBe('user');
  });

  it('still downgrades a district the user never mentioned', () => {
    const f = field({ key: 'ubicacion', value: 'Lince' });
    expect(enforceProvenance([f], ['Vivo cerca, me interesa'])[0]!.provenance).toBe('assumed');
  });
});
