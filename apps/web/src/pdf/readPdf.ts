import * as pdfjs from 'pdfjs-dist';

// Vite needs the worker resolved explicitly. Without this the reader hangs
// with no error at all, which is worse than failing.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export const MAX_BYTES = 20 * 1024 * 1024;

/** Below this, page 1 has no usable text layer and we render it instead.
 *  The two text-layer banks give ~4,500 characters; the scans give ~1. */
const TEXT_LAYER_MIN = 200;

/** Wide enough for the model to read a dot-matrix schedule, small enough to
 *  keep the payload modest. A page-1 crop at this width cost 645 prompt tokens. */
const RENDER_WIDTH = 1200;

export type DocumentInput =
  | { kind: 'text'; text: string }
  | { kind: 'image'; dataUrl: string };

export type PdfErrorCode = 'notPdf' | 'encrypted' | 'tooLarge' | 'unreadable';

export class PdfReadError extends Error {
  constructor(readonly code: PdfErrorCode) {
    super(code);
    this.name = 'PdfReadError';
  }
}

/**
 * Reads page 1 and only page 1: all five sample banks carry the condition block
 * there, so the rest of the document is the amortisation table repeating.
 * The file itself never leaves the browser.
 */
export async function readFirstPage(file: File): Promise<DocumentInput> {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new PdfReadError('notPdf');
  }
  if (file.size > MAX_BYTES) throw new PdfReadError('tooLarge');

  let doc: pdfjs.PDFDocumentProxy;
  try {
    doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  } catch (err) {
    const name = (err as { name?: string })?.name;
    throw new PdfReadError(name === 'PasswordException' ? 'encrypted' : 'unreadable');
  }

  try {
    const page = await doc.getPage(1);
    const content = await page.getTextContent();
    const text = content.items
      .map((i) => ('str' in i ? i.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (text.length >= TEXT_LAYER_MIN) return { kind: 'text', text };

    // No text layer: it is a scan or a photo, so render it and let the model read it.
    const viewport = page.getViewport({ scale: 1 });
    const scale = RENDER_WIDTH / viewport.width;
    const scaled = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(scaled.width);
    canvas.height = Math.ceil(scaled.height);
    const canvasContext = canvas.getContext('2d');
    if (!canvasContext) throw new PdfReadError('unreadable');
    await page.render({ canvasContext, viewport: scaled }).promise;
    return { kind: 'image', dataUrl: canvas.toDataURL('image/jpeg', 0.8) };
  } catch (err) {
    if (err instanceof PdfReadError) throw err;
    throw new PdfReadError('unreadable');
  } finally {
    void doc.destroy();
  }
}
