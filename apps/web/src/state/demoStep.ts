import { en } from '../i18n/en';
import { es } from '../i18n/es';
import type { ChatState } from './chatReducer';

export const DEMO_STEPS = 4;

/**
 * The guided demo's current step, 1–4, or 5 once the path is done: the first
 * step not yet done. A prompt counts as sent in either language, so switching
 * language mid-demo does not send the reader back.
 */
export function demoStep(state: Pick<ChatState, 'messages' | 'fields' | 'savedScenarios'>): number {
  const sent = new Set(state.messages.flatMap((m) => (m.role === 'user' ? [m.content] : [])));
  const wasSent = (i: number) => [en, es].some((copy) => {
    const prompt = copy.demo.steps[i]!.prompt;
    return prompt !== undefined && sent.has(prompt);
  });
  const done = [
    wasSent(0),
    wasSent(1) || (state.fields.tasa !== undefined && state.fields.plazo !== undefined),
    wasSent(2),
    state.savedScenarios.length > 0,
  ];
  const next = done.indexOf(false);
  return next === -1 ? DEMO_STEPS + 1 : next + 1;
}
