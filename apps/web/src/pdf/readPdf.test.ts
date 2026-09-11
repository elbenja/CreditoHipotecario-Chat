import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {},
  getDocument: vi.fn(),
}));

import { getDocument } from 'pdfjs-dist';
import { MAX_BYTES, PdfReadError, readFirstPage } from './readPdf.ts';

function fakeFile(name: string, type: string, bytes: number): File {
  const f = new File([new Uint8Array(1)], name, { type });
  Object.defineProperty(f, 'size', { value: bytes });
  Object.defineProperty(f, 'arrayBuffer', {
    value: async () => new ArrayBuffer(bytes > 0 ? 1 : 0),
  });
  return f;
}

/** A file whose arrayBuffer() itself rejects, mimicking NotReadableError:
 *  the picked file was moved/renamed, its drive was ejected, permission was
 *  revoked, or a cloud-backed file went offline before we could read it. */
function fakeUnreadableFile(name: string, type: string, bytes: number): File {
  const f = new File([new Uint8Array(1)], name, { type });
  Object.defineProperty(f, 'size', { value: bytes });
  Object.defineProperty(f, 'arrayBuffer', {
    value: async () => {
      const error = new Error('The requested file could not be read.');
      error.name = 'NotReadableError';
      throw error;
    },
  });
  return f;
}

/** Mimics a PDFDocumentLoadingTask whose .promise rejects, so we can assert
 *  the failure path destroys the loading task instead of leaking its worker.
 *  The rejection is marked handled immediately so an unawaited promise here
 *  never surfaces as an unhandled rejection in the suite. */
function fakeFailingLoadingTask(error: unknown) {
  const promise = Promise.reject(error);
  promise.catch(() => {});
  return { promise, destroy: vi.fn().mockResolvedValue(undefined) };
}

describe('readFirstPage guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it('maps a PasswordException from pdf.js to the encrypted code, and destroys the leaked loading task', async () => {
    const task = fakeFailingLoadingTask({ name: 'PasswordException' });
    vi.mocked(getDocument).mockReturnValue(task as never);

    const result = readFirstPage(fakeFile('secreto.pdf', 'application/pdf', 1000));

    await expect(result).rejects.toBeInstanceOf(PdfReadError);
    await expect(result).rejects.toMatchObject({ code: 'encrypted' });

    expect(getDocument).toHaveBeenCalled();
    expect(task.destroy).toHaveBeenCalledTimes(1);
  });

  it('maps any other pdf.js load failure to unreadable, not encrypted', async () => {
    const task = fakeFailingLoadingTask({ name: 'InvalidPDFException' });
    vi.mocked(getDocument).mockReturnValue(task as never);

    await expect(readFirstPage(fakeFile('roto.pdf', 'application/pdf', 1000)))
      .rejects.toMatchObject({ code: 'unreadable' });

    expect(getDocument).toHaveBeenCalled();
    expect(task.destroy).toHaveBeenCalledTimes(1);
  });

  it('wraps a failure to even read the file (e.g. NotReadableError) as unreadable, without touching a loading task', async () => {
    await expect(
      readFirstPage(fakeUnreadableFile('movido.pdf', 'application/pdf', 1000)),
    ).rejects.toMatchObject({ code: 'unreadable' });

    expect(getDocument).not.toHaveBeenCalled();
  });
});
