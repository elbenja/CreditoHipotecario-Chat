import { describe, expect, it } from 'vitest';
import { CHAT_COMPLETION_LIMIT, classifyModelError, getModelPolicy } from './kimi.ts';

describe('Kimi request policy', () => {
  it('keeps chat completions below the former 4000-token ceiling', () => {
    expect(CHAT_COMPLETION_LIMIT).toBeLessThanOrEqual(1600);
  });

  it('uses direct answers for chat while preserving the document budget', () => {
    expect(getModelPolicy('chat')).toMatchObject({
      model: 'kimi-k2.6',
      maxCompletionTokens: CHAT_COMPLETION_LIMIT,
      thinking: { type: 'disabled' },
    });
    expect(getModelPolicy('document')).toMatchObject({ maxCompletionTokens: 4000 });
    expect(getModelPolicy('document').thinking).toBeUndefined();
  });

  it('classifies HTTP 400 as a request rejection', () => {
    expect(classifyModelError({ status: 400 })).toEqual({ kind: 'request', status: 400 });
  });

  it('classifies transport failures as connection errors', () => {
    expect(classifyModelError(new TypeError('fetch failed'))).toEqual({ kind: 'connection' });
  });
});
