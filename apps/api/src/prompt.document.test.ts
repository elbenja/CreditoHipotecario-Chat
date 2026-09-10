import { describe, expect, it } from 'vitest';
import { buildDocumentMessages, DOCUMENT_PROMPT } from './prompt.ts';

describe('DOCUMENT_PROMPT', () => {
  // Load-bearing, not decorative: without the synonym table the model scored
  // 9/10 on the BIF photo and missed valorInmueble; with it, 10/10.
  it('names the synonyms every bank uses', () => {
    for (const s of [
      'Monto Prestamo', 'IMPORTE CONCEDIDO', 'MONTO DE CREDITO',
      'Monto Asegurado', 'Imp. Bien', 'Nro. de Cuotas', 'PLAZO TOTAL',
    ]) {
      expect(DOCUMENT_PROMPT).toContain(s);
    }
  });

  it('asks for the dudosos list', () => {
    expect(DOCUMENT_PROMPT).toContain('dudosos');
  });
});

describe('buildDocumentMessages', () => {
  it('sends text as plain content', () => {
    const m = buildDocumentMessages({ kind: 'text', text: 'TEA: 6.30 %' });
    expect(m).toHaveLength(1);
    expect(String(m[0]!.content)).toContain('TEA: 6.30 %');
  });

  it('sends an image as a content part alongside the prompt', () => {
    const m = buildDocumentMessages({ kind: 'image', dataUrl: 'data:image/jpeg;base64,AAA' });
    const parts = m[0]!.content as { type: string }[];
    expect(Array.isArray(parts)).toBe(true);
    expect(parts.map((p) => p.type)).toEqual(['text', 'image_url']);
  });
});
