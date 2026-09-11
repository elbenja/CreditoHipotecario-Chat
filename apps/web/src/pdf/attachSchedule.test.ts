import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Action } from '../state/chatReducer';
import { streamChat } from '../api/streamChat';
import { attachSchedule } from './attachSchedule';
import { readFirstPage } from './readPdf';

// No live model call, no touching an actual PDF.
vi.mock('./readPdf', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./readPdf')>();
  return { ...actual, readFirstPage: vi.fn() };
});

vi.mock('../api/streamChat', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/streamChat')>();
  return { ...actual, streamChat: vi.fn() };
});

const pdf = () => new File([new Uint8Array(1)], 'cronograma.pdf', { type: 'application/pdf' });

describe('attachSchedule error kind', () => {
  beforeEach(() => {
    vi.mocked(readFirstPage).mockReset();
    vi.mocked(streamChat).mockReset();
    vi.mocked(readFirstPage).mockResolvedValue({ kind: 'text', text: 'TEA 6.30' });
  });

  // The server tags an unreadable schedule 'document', distinct from 'api'
  // (the model call itself failing) — collapsing both to 'api' would show
  // the same generic message for a document problem as for a dead connection.
  it("passes the server's 'document' error kind through instead of collapsing it to 'api'", async () => {
    vi.mocked(streamChat).mockImplementation(async (_body, onEvent) => {
      onEvent({
        event: 'error',
        data: { kind: 'document', message: 'Esto no parece un cronograma de pagos.' },
      });
    });

    const actions: Action[] = [];
    await attachSchedule(pdf(), (a) => actions.push(a), []);

    expect(actions).toContainEqual(
      expect.objectContaining({
        type: 'error',
        kind: 'document',
        message: 'Esto no parece un cronograma de pagos.',
      }),
    );
  });

  it("falls back to 'api' for any other server error kind", async () => {
    vi.mocked(streamChat).mockImplementation(async (_body, onEvent) => {
      onEvent({ event: 'error', data: { kind: 'api', message: 'Se cayó la conexión.' } });
    });

    const actions: Action[] = [];
    await attachSchedule(pdf(), (a) => actions.push(a), []);

    expect(actions).toContainEqual(
      expect.objectContaining({ type: 'error', kind: 'api', message: 'Se cayó la conexión.' }),
    );
  });
});

describe('attachSchedule progress', () => {
  beforeEach(() => {
    vi.mocked(readFirstPage).mockReset();
    vi.mocked(streamChat).mockReset();
  });

  it('announces the file before reading it, so the screen can show the row', async () => {
    vi.mocked(readFirstPage).mockResolvedValue({ kind: 'text', text: 'TEA 6.30' });
    vi.mocked(streamChat).mockResolvedValue(undefined);

    const actions: Action[] = [];
    await attachSchedule(pdf(), (a) => actions.push(a), []);

    expect(actions[0]).toEqual({ type: 'attachStart', name: 'cronograma.pdf', size: 1 });
  });
});
