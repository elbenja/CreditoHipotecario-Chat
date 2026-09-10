import { describe, expect, it, vi } from 'vitest';
import { MAX_BYTES, PdfReadError, readFirstPage } from './readPdf.ts';

function fakeFile(name: string, type: string, bytes: number): File {
  const f = new File([new Uint8Array(1)], name, { type });
  Object.defineProperty(f, 'size', { value: bytes });
  return f;
}

describe('readFirstPage guards', () => {
  it('rejects a file that is not a PDF before opening it', async () => {
    await expect(readFirstPage(fakeFile('foto.png', 'image/png', 1000)))
      .rejects.toMatchObject({ code: 'notPdf' });
  });

  it('rejects a file over the 20MB cap', async () => {
    await expect(readFirstPage(fakeFile('grande.pdf', 'application/pdf', MAX_BYTES + 1)))
      .rejects.toMatchObject({ code: 'tooLarge' });
  });

  it('caps at 20MB', () => {
    expect(MAX_BYTES).toBe(20 * 1024 * 1024);
  });

  it('reports encrypted PDFs distinctly, so the message can be useful', () => {
    const e = new PdfReadError('encrypted');
    expect(e.code).toBe('encrypted');
    expect(e).toBeInstanceOf(Error);
  });
});
