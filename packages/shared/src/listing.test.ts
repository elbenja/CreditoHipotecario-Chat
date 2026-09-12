import { describe, expect, it } from 'vitest';
import {
  ListingSchema,
  findListingUrl,
  isListingHost,
  listingRefusal,
  listingToFields,
  type Listing,
} from './listing.ts';

const ASPIRIA: Listing = {
  proyecto: 'ASPIRIA',
  constructora: 'GRUPO T&C',
  direccion: 'Av. El Sol Este 530',
  distrito: 'Barranco',
  entrega: 'febrero 2027',
  etapa: 'En construcción',
  modelos: [
    { nombre: 'TIPO 3', area: '82.96', precioDesde: '664,806', dormitorios: '3' },
    { nombre: 'TIPO 7', area: '41.75', precioDesde: '363,906', dormitorios: '1' },
  ],
  fuente: { host: 'nexoinmobiliario.pe', url: 'https://nexoinmobiliario.pe/departamentos/barranco/aspiria-1631' },
  dudosos: [],
};

describe('findListingUrl', () => {
  it('takes the first URL in a message and lowercases its host', () => {
    const r = findListingUrl('mira este https://WWW.NexoInmobiliario.pe/departamentos/barranco/aspiria-1631 y este https://urbania.pe/x');
    expect(r).toEqual({
      url: 'https://WWW.NexoInmobiliario.pe/departamentos/barranco/aspiria-1631',
      host: 'www.nexoinmobiliario.pe',
    });
  });

  it('returns null when there is no URL', () => {
    expect(findListingUrl('depa de 300 mil en Barranco')).toBeNull();
  });

  it('ignores a scheme-less domain — only http(s) URLs count', () => {
    expect(findListingUrl('nexoinmobiliario.pe/algo')).toBeNull();
  });

  it('strips trailing punctuation swallowed into the match', () => {
    const r = findListingUrl('mira https://nexoinmobiliario.pe/departamentos/barranco/aspiria-1631. ¿qué opinas?');
    expect(r?.url.endsWith('aspiria-1631')).toBe(true);
  });
});

describe('isListingHost', () => {
  it('accepts the two Nexo hosts only', () => {
    expect(isListingHost('nexoinmobiliario.pe')).toBe(true);
    expect(isListingHost('www.nexoinmobiliario.pe')).toBe(true);
    expect(isListingHost('urbania.pe')).toBe(false);
  });

  it('rejects look-alike hosts', () => {
    expect(isListingHost('nexoinmobiliario.pe.evil.com')).toBe(false);
    expect(isListingHost('evil.nexoinmobiliario.pe')).toBe(false);
    expect(isListingHost('nexoinmobiliario.pe.')).toBe(false);
  });
});

describe('listingRefusal', () => {
  it('names the host and offers the PDF route', () => {
    expect(listingRefusal('urbania.pe')).toBe(
      'De urbania.pe no puedo leer el anuncio. Pégame los datos o el link de Nexo — o guarda la página como PDF y súbela aquí.',
    );
  });
});

describe('ListingSchema', () => {
  it('tolerates null optionals and numeric dormitorios', () => {
    const parsed = ListingSchema.parse({
      proyecto: 'X', constructora: null, direccion: null, distrito: 'Lince', entrega: null, etapa: null,
      modelos: [{ nombre: null, area: '55', precioDesde: 'S/ 300,000', dormitorios: 2 }],
      fuente: { host: 'pdf' },
    });
    expect(parsed.constructora).toBeUndefined();
    expect(parsed.modelos[0]!.nombre).toBeUndefined();
    expect(parsed.modelos[0]!.dormitorios).toBe('2');
    expect(parsed.dudosos).toEqual([]);
  });

  it('accepts area and precioDesde as numbers, the way the live model emits them', () => {
    const parsed = ListingSchema.parse({
      proyecto: 'ASPIRIA', distrito: 'Barranco',
      modelos: [{ nombre: 'TIPO 3', area: 82.96, precioDesde: 664806, dormitorios: 3 }],
      fuente: { host: 'pdf' },
    });
    expect(parsed.modelos[0]).toEqual({ nombre: 'TIPO 3', area: '82.96', precioDesde: '664,806', dormitorios: '3' });
  });

  it('normalises a currency/unit marker the model folded into the value (D1)', () => {
    const parsed = ListingSchema.parse({
      proyecto: 'ASPIRIA', distrito: 'Barranco',
      modelos: [{ nombre: 'TIPO 3', precioDesde: 'desde S/ 664,806', area: '82.96 m²' }],
      fuente: { host: 'pdf' },
    });
    expect(parsed.modelos[0]!.precioDesde).toBe('664,806');
    expect(parsed.modelos[0]!.area).toBe('82.96');
  });

  it('strips S/ from a bare price and groups it', () => {
    const parsed = ListingSchema.parse({
      proyecto: 'X', distrito: 'Lince',
      modelos: [{ precioDesde: 'S/ 300000' }],
      fuente: { host: 'pdf' },
    });
    expect(parsed.modelos[0]!.precioDesde).toBe('300,000');
  });

  it('normalises to undefined when nothing is left after stripping', () => {
    const parsed = ListingSchema.parse({
      proyecto: 'X', distrito: 'Lince',
      modelos: [{ nombre: 'X', precioDesde: 'S/', area: 'm²' }],
      fuente: { host: 'pdf' },
    });
    expect(parsed.modelos[0]!.precioDesde).toBeUndefined();
    expect(parsed.modelos[0]!.area).toBeUndefined();
  });
});

describe('listingToFields', () => {
  it('maps a chosen model to ubicacion, precio and area with anuncio provenance', () => {
    const f = Object.fromEntries(listingToFields(ASPIRIA, ASPIRIA.modelos[0]!).map((x) => [x.key, x]));
    expect(Object.keys(f).sort()).toEqual(['area', 'precio', 'ubicacion']);
    expect(f.ubicacion!.value).toBe('Av. El Sol Este 530, Barranco');
    expect(f.ubicacion!.provenance).toBe('anuncio');
    expect(f.ubicacion!.note).toBe('Proyecto ASPIRIA · GRUPO T&C · entrega febrero 2027');
    expect(f.precio!.value).toBe('664,806');
    expect(f.precio!.prefix).toBe('S/');
    expect(f.precio!.note).toBe("Precio 'desde' del modelo TIPO 3");
    expect(f.area!.value).toBe('82.96');
    expect(f.area!.suffix).toBe('m²');
  });

  it('strips a currency or unit the model folded into the value, and groups a bare integer', () => {
    // A real Listing is always produced by ListingSchema.parse, which is
    // where the stripping now happens — so this exercises the actual path.
    const listing = ListingSchema.parse({
      ...ASPIRIA,
      modelos: [{ nombre: undefined, area: '55.00 m²', precioDesde: 'S/ 300000', dormitorios: undefined }],
    });
    const f = Object.fromEntries(listingToFields(listing, listing.modelos[0]!).map((x) => [x.key, x]));
    expect(f.precio!.value).toBe('300,000');
    expect(f.precio!.note).toBe('Precio del anuncio');
    expect(f.area!.value).toBe('55.00');
  });

  it('does not repeat the district when the address already ends with it', () => {
    const listing: Listing = { ...ASPIRIA, direccion: 'Av. El Sol Este 530, Barranco' };
    const f = listingToFields(listing, listing.modelos[0]!).find((x) => x.key === 'ubicacion')!;
    expect(f.value).toBe('Av. El Sol Este 530, Barranco');
  });

  it('with no model, pins only ubicacion', () => {
    const keys = listingToFields(ASPIRIA, null).map((x) => x.key);
    expect(keys).toEqual(['ubicacion']);
  });

  it('demotes a field the model listed as dudoso', () => {
    const listing: Listing = { ...ASPIRIA, dudosos: ['precioDesde', 'distrito'] };
    const f = Object.fromEntries(listingToFields(listing, listing.modelos[0]!).map((x) => [x.key, x]));
    expect(f.precio!.provenance).toBe('assumed');
    expect(f.ubicacion!.provenance).toBe('assumed');
    expect(f.area!.provenance).toBe('anuncio');
  });

  it('groups a numeric price the model sent bare', () => {
    const listing = ListingSchema.parse({
      proyecto: 'A', distrito: 'Lince', modelos: [{ area: 55, precioDesde: 300000 }], fuente: { host: 'pdf' },
    });
    const f = Object.fromEntries(listingToFields(listing, listing.modelos[0]!).map((x) => [x.key, x]));
    expect(f.precio!.value).toBe('300,000');
    expect(f.area!.value).toBe('55');
  });
});
