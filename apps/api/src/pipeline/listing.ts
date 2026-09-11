import { ListingExtractionSchema, ListingSchema, type Listing } from '@chat/shared';

export type ListingResult =
  | { ok: true; listing: Listing }
  | { ok: false; reason: 'unparsable' | 'notListing' };

/** Models wrap JSON in fences often enough to handle it rather than fail. */
function stripFences(raw: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/.exec(raw);
  return (fenced?.[1] ?? raw).trim();
}

/**
 * Validates a listing extraction and stamps where it came from. Shared by
 * the link route (fuente = the fetched host and URL) and the PDF route
 * (fuente = { host: 'pdf' }). A `tipo` key, if present, is ignored here —
 * the document pipeline dispatches on it before calling this.
 */
export function runListingPipeline(raw: string, fuente: { host: string; url?: string }): ListingResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch {
    return { ok: false, reason: 'unparsable' };
  }

  if (typeof parsed === 'object' && parsed !== null && (parsed as { tipo?: unknown }).tipo === 'otro') {
    return { ok: false, reason: 'notListing' };
  }

  const result = ListingExtractionSchema.safeParse(parsed);
  // A missing proyecto or distrito is the model's "this is not a listing"
  // answer, not a broken reply.
  if (!result.success) {
    const missingRequired = result.error.issues.some(
      (i) => (i.path[0] === 'proyecto' || i.path[0] === 'distrito') && i.path.length === 1,
    );
    return { ok: false, reason: missingRequired ? 'notListing' : 'unparsable' };
  }

  const modelos = result.data.modelos.filter((m) => m.precioDesde || m.area);
  if (modelos.length === 0) return { ok: false, reason: 'notListing' };

  return { ok: true, listing: ListingSchema.parse({ ...result.data, modelos, fuente }) };
}
