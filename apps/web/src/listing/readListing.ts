import type { PinnedField } from '@chat/shared';
import { streamChat } from '../api/streamChat';
import type { Action } from '../state/chatReducer';

/**
 * Sends a listing URL for the server to read. Sibling of pdf/attachSchedule:
 * same progress row, same event handling, but nothing is read in the browser
 * — the page never comes here, only the extracted listing does.
 */
export async function readListing(
  url: string,
  host: string,
  dispatch: (action: Action) => void,
  fields: PinnedField[],
): Promise<void> {
  // size 0 is the row's cue that there is no local file to read.
  dispatch({ type: 'attachStart', name: host, size: 0 });

  await streamChat(
    { messages: [{ role: 'user', content: url }], fields, listing: { url } },
    (e) => {
      const data = e.data as Record<string, any>;
      if (e.event === 'status') dispatch({ type: 'status', phase: data.phase });
      else if (e.event === 'analyzeStep') dispatch({ type: 'analyzeStep', label: data.label });
      else if (e.event === 'listing') dispatch({ type: 'listingReady', listing: data.listing });
      else if (e.event === 'error')
        dispatch({
          type: 'error',
          kind: data.kind === 'listing' ? 'listing' : 'api',
          message: data.message,
          // The pasted message, so "Editar" can seed the composer with it.
          retry: url,
        });
    },
  );
}
