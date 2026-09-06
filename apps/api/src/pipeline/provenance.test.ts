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

  const LIVE = 'Depa de 250 mil en Pueblo Libre, 40 m², tasa 8%. ¿A cuánto lo alquilo?';

  it('matches a price the user wrote with the word mil', () => {
    const f = field({ key: 'precio', value: '250,000' });
    expect(enforceProvenance([f], [LIVE])[0]!.provenance).toBe('user');
  });

  it('matches a price the user wrote with the word millones', () => {
    const f = field({ key: 'precio', value: '1,500,000' });
    expect(enforceProvenance([f], ['Una casa de 1.5 millones'])[0]!.provenance).toBe('user');
  });

  it('matches a district the model expanded with the city', () => {
    const f = field({ key: 'ubicacion', value: 'Pueblo Libre, Lima' });
    expect(enforceProvenance([f], [LIVE])[0]!.provenance).toBe('user');
  });

  it('does not let an expanded value match on its trailing segment alone', () => {
    const f = field({ key: 'ubicacion', value: 'Ate, Lima' });
    expect(enforceProvenance([f], ['Un depa en Lima'])[0]!.provenance).toBe('assumed');
  });

  it('still downgrades a value the model invented for that same turn', () => {
    const inicial = field({ key: 'inicial', value: '20' });
    expect(enforceProvenance([inicial], [LIVE])[0]!.provenance).toBe('assumed');
  });

  it('matches the area and rate from that same turn', () => {
    const area = field({ key: 'area', value: '40' });
    const tasa = field({ key: 'tasa', value: '8' });
    expect(enforceProvenance([area], [LIVE])[0]!.provenance).toBe('user');
    expect(enforceProvenance([tasa], [LIVE])[0]!.provenance).toBe('user');
  });

  const CROSS = 'Depa de 250 mil en Pueblo Libre, 40 m2, plazo 20 años';

  it('does not let a term the user gave validate a down payment', () => {
    const f = field({ key: 'inicial', value: '20' });
    expect(enforceProvenance([f], [CROSS])[0]!.provenance).toBe('assumed');
  });

  it('does not let an area the user gave validate a rate', () => {
    const f = field({ key: 'tasa', value: '40' });
    expect(enforceProvenance([f], [CROSS])[0]!.provenance).toBe('assumed');
  });

  it('does not let the base of a scaled number validate an area', () => {
    const f = field({ key: 'area', value: '250' });
    expect(enforceProvenance([f], [CROSS])[0]!.provenance).toBe('assumed');
  });

  it('still credits the term and area the user actually gave', () => {
    expect(enforceProvenance([field({ key: 'plazo', value: '20' })], [CROSS])[0]!.provenance).toBe('user');
    expect(enforceProvenance([field({ key: 'area', value: '40' })], [CROSS])[0]!.provenance).toBe('user');
  });

  it('does not treat quoted savings as a down payment', () => {
    const f = field({ key: 'inicial', value: '90,000' });
    expect(enforceProvenance([f], ['Tengo S/ 90,000 ahorrados'])[0]!.provenance).toBe('assumed');
  });

  it('does not treat a street number as a price', () => {
    const f = field({ key: 'precio', value: '2500' });
    expect(enforceProvenance([f], ['Vivo en la Av. Arequipa 2500'])[0]!.provenance).toBe('assumed');
  });

  it('does not credit a district the user ruled out', () => {
    const f = field({ key: 'ubicacion', value: 'Miraflores' });
    expect(enforceProvenance([f], ['No es en Miraflores, es en Ate'])[0]!.provenance).toBe('assumed');
  });

  it('does not credit a price the user ruled out', () => {
    const f = field({ key: 'precio', value: '250,000' });
    expect(enforceProvenance([f], ['No tengo 250 mil, solo 200 mil'])[0]!.provenance).toBe('assumed');
  });

  it('still credits the value the user affirmed in that same correction', () => {
    const f = field({ key: 'precio', value: '200,000' });
    expect(enforceProvenance([f], ['No tengo 250 mil, solo 200 mil'])[0]!.provenance).toBe('user');
  });

  it('is not poisoned by an unrelated negation elsewhere in the turn', () => {
    const f = field({ key: 'precio', value: '250,000' });
    expect(enforceProvenance([f], ['Un depa que no está amoblado, cuesta 250 mil'])[0]!.provenance).toBe('user');
  });

  it('credits a down payment stated as a percentage', () => {
    const f = field({ key: 'inicial', value: '30' });
    expect(enforceProvenance([f], ['Puedo poner 30% de inicial'])[0]!.provenance).toBe('user');
  });
});
