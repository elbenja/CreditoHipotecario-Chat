import { describe, expect, it } from 'vitest';
import { runListingPipeline } from './listing.ts';

const FUENTE = { host: 'nexoinmobiliario.pe', url: 'https://nexoinmobiliario.pe/departamentos/barranco/aspiria-1631' };

const FULL = JSON.stringify({
  proyecto: 'ASPIRIA', constructora: 'GRUPO T&C', direccion: 'Av. El Sol Este 530', distrito: 'Barranco',
  entrega: '28 de Febrero, 2027', etapa: 'En construcción',
  modelos: [
    { nombre: 'TIPO 3', area: '82.96', precioDesde: '664,806', dormitorios: 3 },
    { nombre: 'TIPO 7', area: '41.75', precioDesde: '363,906', dormitorios: 1 },
  ],
  dudosos: [],
});

function listingOf(raw: string) {
  const r = runListingPipeline(raw, FUENTE);
  if (!r.ok) throw new Error(`expected ok, got ${r.reason}`);
  return r.listing;
}

describe('runListingPipeline', () => {
  it('turns a full extraction into a listing carrying its source', () => {
    const l = listingOf(FULL);
    expect(l.proyecto).toBe('ASPIRIA');
    expect(l.modelos).toHaveLength(2);
    expect(l.modelos[0]!.dormitorios).toBe('3');
    expect(l.fuente).toEqual(FUENTE);
  });

  it('strips markdown fences the model sometimes adds', () => {
    expect(runListingPipeline('```json\n' + FULL + '\n```', FUENTE).ok).toBe(true);
  });

  it('ignores a tipo discriminator when the reply carries one (shared with the PDF route)', () => {
    const raw = JSON.stringify({ ...JSON.parse(FULL), tipo: 'anuncio' });
    expect(runListingPipeline(raw, FUENTE).ok).toBe(true);
  });

  it('reports unparsable on broken JSON', () => {
    expect(runListingPipeline('{"proyecto": ', FUENTE)).toEqual({ ok: false, reason: 'unparsable' });
  });

  it('reports notListing when the model says tipo otro', () => {
    expect(runListingPipeline(JSON.stringify({ tipo: 'otro' }), FUENTE)).toEqual({ ok: false, reason: 'notListing' });
  });

  it('reports notListing when there is no district', () => {
    const raw = JSON.stringify({ ...JSON.parse(FULL), distrito: null });
    expect(runListingPipeline(raw, FUENTE)).toEqual({ ok: false, reason: 'notListing' });
  });

  it('reports notListing when no model carries a price or an area', () => {
    const raw = JSON.stringify({ ...JSON.parse(FULL), modelos: [{ nombre: 'X' }] });
    expect(runListingPipeline(raw, FUENTE)).toEqual({ ok: false, reason: 'notListing' });
    const empty = JSON.stringify({ ...JSON.parse(FULL), modelos: [] });
    expect(runListingPipeline(empty, FUENTE)).toEqual({ ok: false, reason: 'notListing' });
  });

  it('drops models with neither price nor area but keeps the rest', () => {
    const raw = JSON.stringify({
      ...JSON.parse(FULL),
      modelos: [{ nombre: 'X' }, { nombre: 'TIPO 7', area: '41.75', precioDesde: '363,906' }],
    });
    expect(listingOf(raw).modelos.map((m) => m.nombre)).toEqual(['TIPO 7']);
  });
});
