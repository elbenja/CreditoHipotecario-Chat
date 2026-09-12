import { z } from 'zod';
import type { PinnedField } from './envelope.ts';
import { groupFieldValue } from './format.ts';

/** The only hosts the server will ever fetch. Urbania sits behind a
 *  Cloudflare Managed Challenge (verified 2026-09-10/11) and is out. */
export const LISTING_HOSTS = ['nexoinmobiliario.pe', 'www.nexoinmobiliario.pe'] as const;

// The model sends absent or explicit null interchangeably; both mean "not
// stated". Same tolerance PinnedField already has.
const optionalText = z
  .string()
  .nullish()
  .transform((v) => (v?.trim() ? v.trim() : undefined));

export const ListingModelSchema = z.object({
  nombre: optionalText,
  // Models emit "82.96" and 82.96 interchangeably for area, sometimes with a
  // trailing unit despite the prompt. Stripped here so a Listing always
  // carries a bare value — the UI adds the m² suffix itself.
  area: z
    .union([z.string(), z.number()])
    .nullish()
    .transform((v) => {
      if (v === null || v === undefined) return undefined;
      const str = String(v).trim().replace(/\s*m\s*(²|2)\s*$/i, '').trim();
      return str ? str : undefined;
    }),
  // Models emit "664,806" and 664806 interchangeably for precioDesde,
  // sometimes with a leading "desde" and/or "S/" despite the prompt.
  // Stripped here (in either order) and grouped, so a Listing always
  // carries a bare value — the UI adds "desde S/ " itself.
  precioDesde: z
    .union([z.string(), z.number()])
    .nullish()
    .transform((v) => {
      if (v === null || v === undefined) return undefined;
      let str = String(v).trim();
      let prev: string;
      do {
        prev = str;
        str = str.replace(/^desde\s+/i, '').replace(/^S\/\.?\s*/i, '').trim();
      } while (str !== prev);
      return str ? groupFieldValue(str) : undefined;
    }),
  // Models emit "3" and 3 interchangeably.
  dormitorios: z
    .union([z.string(), z.number()])
    .nullish()
    .transform((v) => (v === null || v === undefined || v === '' ? undefined : String(v))),
});

/** What the extraction prompt asks the model to answer with. No `fuente`:
 *  the server knows where the text came from; the model does not. */
export const ListingExtractionSchema = z.object({
  proyecto: z.string().trim().min(1),
  constructora: optionalText,
  direccion: optionalText,
  distrito: z.string().trim().min(1),
  entrega: optionalText,
  etapa: optionalText,
  modelos: z.array(ListingModelSchema).default([]),
  /** Fields the model did not read with confidence. Load-bearing, as in Fase B. */
  dudosos: z.array(z.string()).default([]),
});

export const ListingSchema = ListingExtractionSchema.extend({
  fuente: z.object({ host: z.string().min(1), url: z.string().optional() }),
});

export type ListingModel = z.infer<typeof ListingModelSchema>;
export type ListingExtraction = z.infer<typeof ListingExtractionSchema>;
export type Listing = z.infer<typeof ListingSchema>;

/** The first http(s) URL in a message, with its host lowercased. */
export function findListingUrl(text: string): { url: string; host: string } | null {
  const m = /https?:\/\/[^\s<>"']+/i.exec(text);
  if (!m) return null;
  try {
    return { url: m[0], host: new URL(m[0]).hostname.toLowerCase() };
  } catch {
    return null;
  }
}

export function isListingHost(host: string): boolean {
  return (LISTING_HOSTS as readonly string[]).includes(host.toLowerCase());
}

export function listingRefusal(host: string): string {
  return `De ${host} no puedo leer el anuncio. Pégame los datos o el link de Nexo — o guarda la página como PDF y súbela aquí.`;
}

/**
 * The property half of the panel, from a listing and the model the user
 * chose. `null` model — the user has not chosen yet — pins the location only.
 * A key in `dudosos` arrives `assumed`, never `anuncio`: the same rule that
 * keeps a misread digit from presenting as read-from-the-bank.
 */
export function listingToFields(listing: Listing, model: ListingModel | null): PinnedField[] {
  const dudosos = new Set(listing.dudosos);
  const out: PinnedField[] = [];

  const distrito = listing.distrito.trim();
  const direccion = listing.direccion?.trim();
  const ubicacion =
    direccion && !direccion.toLowerCase().endsWith(distrito.toLowerCase())
      ? `${direccion}, ${distrito}`
      : (direccion ?? distrito);
  out.push({
    key: 'ubicacion',
    label: 'Ubicación',
    value: ubicacion,
    prefix: undefined,
    suffix: undefined,
    provenance: dudosos.has('distrito') || dudosos.has('direccion') ? 'assumed' : 'anuncio',
    note: [
      `Proyecto ${listing.proyecto}`,
      listing.constructora,
      listing.entrega ? `entrega ${listing.entrega}` : undefined,
    ]
      .filter(Boolean)
      .join(' · '),
  });

  if (!model) return out;

  if (model.precioDesde) {
    out.push({
      key: 'precio',
      label: 'Precio',
      value: model.precioDesde,
      prefix: 'S/',
      suffix: undefined,
      provenance: dudosos.has('precioDesde') ? 'assumed' : 'anuncio',
      note: model.nombre ? `Precio 'desde' del modelo ${model.nombre}` : 'Precio del anuncio',
    });
  }

  if (model.area) {
    out.push({
      key: 'area',
      label: 'Área',
      value: model.area,
      prefix: undefined,
      suffix: 'm²',
      provenance: dudosos.has('area') ? 'assumed' : 'anuncio',
      note: '',
    });
  }

  return out;
}
