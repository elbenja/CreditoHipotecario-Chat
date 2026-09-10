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

  it('strips markdown fences the model sometimes adds', () => {
    expect(runDocumentPipeline('```json\n' + FULL + '\n```').ok).toBe(true);
  });

  it('reports noSchedule when nothing readable came back', () => {
    const r = runDocumentPipeline(JSON.stringify({ dudosos: [] }));
    expect(r).toEqual({ ok: false, reason: 'noSchedule' });
  });

  it('reports unparsable when the reply is not JSON', () => {
    const r = runDocumentPipeline('no pude leer el documento');
    expect(r).toEqual({ ok: false, reason: 'unparsable' });
  });

  it('never lets the model claim user provenance', () => {
    const raw = JSON.stringify({ ...JSON.parse(FULL), provenance: 'user' });
    for (const f of Object.values(fieldsOf(raw))) {
      expect(f.provenance).not.toBe('user');
    }
  });
});
