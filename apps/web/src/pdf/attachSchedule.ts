import type { PinnedField } from '@chat/shared';
import { streamChat } from '../api/streamChat';
import type { Action } from '../state/chatReducer';
import { PdfReadError, readFirstPage, type PdfErrorCode } from './readPdf';

// Every failure the reader can throw, in the copy the user actually sees.
// A password-protected schedule is not "unreadable" — it needs its own line,
// or the person has no idea what to do next.
const PDF_ERRORS: Record<PdfErrorCode, string> = {
  notPdf: 'Eso no es un PDF. Sube el cronograma que te dio el banco.',
  tooLarge: 'Ese archivo pasa los 20 MB. Sube solo el cronograma.',
  encrypted: 'Ese PDF tiene contraseña y no puedo abrirlo.',
  unreadable: 'No pude leer ese PDF.',
};

/**
 * Reads the PDF in the browser and streams the extraction. Shared by every
 * screen that can offer the attach control (the empty state and the active
 * conversation) so the flow behaves identically wherever it starts.
 *
 * Reading the PDF happens in the browser and never touches the network;
 * only the extracted text (or a page-1 render) is sent on. `document`
 * shadows the global of the same name, so it is bound as `doc` below.
 */
export async function attachSchedule(
  file: File,
  dispatch: (action: Action) => void,
  fields: PinnedField[],
): Promise<void> {
  dispatch({ type: 'attachStart', name: file.name, size: file.size });

  let doc;
  try {
    doc = await readFirstPage(file);
  } catch (err) {
    const code = err instanceof PdfReadError ? err.code : 'unreadable';
    dispatch({ type: 'error', kind: 'api', message: PDF_ERRORS[code], retry: null });
    return;
  }

  await streamChat(
    {
      messages: [{ role: 'user', content: 'Adjunto el cronograma de pagos.' }],
      fields,
      document: doc,
    },
    (e) => {
      const data = e.data as Record<string, any>;
      if (e.event === 'status') dispatch({ type: 'status', phase: data.phase });
      else if (e.event === 'analyzeStep') dispatch({ type: 'analyzeStep', label: data.label });
      else if (e.event === 'extraction') dispatch({ type: 'extractionReady', fields: data.fields });
      else if (e.event === 'error')
        // The server tags an extraction failure 'document', distinct from
        // 'api' (the model call itself failing) — keep that distinction
        // rather than collapsing both to 'api'.
        dispatch({
          type: 'error',
          kind: data.kind === 'document' ? 'document' : 'api',
          message: data.message,
          retry: null,
        });
    },
  );
}
