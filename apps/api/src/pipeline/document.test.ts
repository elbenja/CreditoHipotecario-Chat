import { describe, expect, it } from 'vitest';
import { runDocumentPipeline } from './document.ts';

const FULL = JSON.stringify({
  montoFinanciado: '280,000.00', cuota: '2,506.00', tea: '8.990000 %',
  teaTipo: 'fija', tcea: '10.55 %', plazoCuotas: 360,
  seguroDesgravamen: '.048000 %', seguroInmueble: '.029000 %',
  valorInmueble: '618,382.27', totalAPagar: '902,179.33', dudosos: [],
});

function fieldsOf(raw: string) {
  const r = runDocumentPipeline(raw);
  if (!r.ok) throw new Error(`expected ok, got ${r.reason}`);
  if (r.kind !== 'cronograma') throw new Error(`expected cronograma, got ${r.kind}`);
  return Object.fromEntries(r.fields.map((f) => [f.key, f]));
}

describe('runDocumentPipeline', () => {
  it('turns a full extraction into mortgage fields', () => {
    const f = fieldsOf(FULL);
    expect(f.montoFinanciado!.value).toBe('280,000.00');
    expect(f.montoFinanciado!.prefix).toBe('S/');
    expect(f.tea!.value).toBe('8.990000');
    expect(f.tea!.suffix).toBe('%');
    expect(f.plazoCuotas!.value).toBe('360');
  });

  it('marks read values as documento', () => {
    expect(fieldsOf(FULL).tea!.provenance).toBe('documento');
  });

  it('always marks valorInmueble assumed — insured value is not a price', () => {
    expect(fieldsOf(FULL).valorInmueble!.provenance).toBe('assumed');
  });

  it('demotes a field the model listed as dudoso', () => {
    const raw = JSON.stringify({ ...JSON.parse(FULL), dudosos: ['tcea'] });
    const f = fieldsOf(raw);
    expect(f.tcea!.provenance).toBe('assumed');
    expect(f.tea!.provenance).toBe('documento');
  });

  it('carries the rate type as a note, because a variable rate is indicative', () => {
    const raw = JSON.stringify({ ...JSON.parse(FULL), teaTipo: 'variable' });
    expect(fieldsOf(raw).tea!.note).toMatch(/variable/i);
  });

  it('drops absent fields instead of pinning empties', () => {
    const raw = JSON.stringify({ tea: '6.30 %', cuota: null, tcea: null });
    const keys = Object.keys(fieldsOf(raw));
    expect(keys).toEqual(['tea']);
  });

  it('rejects bare affixes (e.g. "S/." or "%") rather than pinning them as values', () => {
    const raw = JSON.stringify({
      montoFinanciado: 'S/.',
      tea: '%',
      cuota: '2,500.00',
      dudosos: [],
    });
    const f = fieldsOf(raw);
    expect(Object.keys(f)).toEqual(['cuota']);
    expect(f.cuota!.value).toBe('2,500.00');
  });

  it('still strips legitimate affixes correctly', () => {
    const raw = JSON.stringify({
      montoFinanciado: 'S/ 280,000.00',
      tea: '8.99 %',
      dudosos: [],
    });
    const f = fieldsOf(raw);
    expect(f.montoFinanciado!.value).toBe('280,000.00');
    expect(f.tea!.value).toBe('8.99');
  });

  it('strips markdown fences the model sometimes adds', () => {
    expect(runDocumentPipeline('```json\n' + FULL + '\n```').ok).toBe(true);
  });

  it('reports otro when nothing readable came back', () => {
    const r = runDocumentPipeline(JSON.stringify({ dudosos: [] }));
    expect(r).toEqual({ ok: false, reason: 'otro' });
  });

  it('reports unparsable when the reply is not JSON', () => {
    const r = runDocumentPipeline('no pude leer el documento');
    expect(r).toEqual({ ok: false, reason: 'unparsable' });
  });

  it('enforces provenance invariant: all fields are exactly documento or assumed', () => {
    // Provenance is structural: the pipeline assigns only 'documento' (for read fields)
    // or 'assumed' (for valorInmueble and dudosos). If a regression adds a third value
    // or a code path leaks the model's input, this test catches it.
    const testCases = [
      { raw: FULL, label: 'normal input' },
      {
        raw: JSON.stringify({ ...JSON.parse(FULL), provenance: 'user' }),
        label: 'hostile: model sends provenance: user',
      },
      {
        raw: JSON.stringify({ ...JSON.parse(FULL), provenance: 'market', unknownField: true }),
        label: 'hostile: extra unknown keys',
      },
      {
        raw: JSON.stringify({
          montoFinanciado: '100,000',
          tea: '5%',
          dudosos: ['tea'],
        }),
        label: 'minimal input with dudoso',
      },
    ];

    for (const { raw, label } of testCases) {
      const r = runDocumentPipeline(raw);
      if (!r.ok || r.kind !== 'cronograma') continue; // ok to have no schedule; we only check fields that exist
      for (const field of r.fields) {
        expect(field.provenance, `${label}: field ${field.key}`).toMatch(/^(documento|assumed)$/);
      }
    }
  });
});

describe('runDocumentPipeline — tipo dispatch', () => {
  const LISTING = {
    tipo: 'anuncio', proyecto: 'ASPIRIA', distrito: 'Barranco',
    modelos: [{ nombre: 'TIPO 7', area: '41.75', precioDesde: '363,906' }], dudosos: [],
  };

  it('routes tipo anuncio to a listing stamped as read from a PDF', () => {
    const r = runDocumentPipeline(JSON.stringify(LISTING));
    expect(r.ok && r.kind === 'anuncio' && r.listing.fuente).toEqual({ host: 'pdf' });
  });

  it('routes tipo cronograma to mortgage fields', () => {
    const r = runDocumentPipeline(JSON.stringify({ ...JSON.parse(FULL), tipo: 'cronograma' }));
    expect(r.ok && r.kind).toBe('cronograma');
  });

  it('reports otro when the model says so', () => {
    expect(runDocumentPipeline(JSON.stringify({ tipo: 'otro' }))).toEqual({ ok: false, reason: 'otro' });
  });

  it('reports otro for an anuncio with no readable model', () => {
    expect(runDocumentPipeline(JSON.stringify({ ...LISTING, modelos: [] }))).toEqual({ ok: false, reason: 'otro' });
  });

  it('still reads a reply with no tipo as a cronograma (older prompt shape)', () => {
    expect(runDocumentPipeline(FULL).ok).toBe(true);
  });
});
