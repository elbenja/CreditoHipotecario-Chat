import type { FieldKey, PinnedField } from '@chat/shared';
import { t } from '../i18n';
import type { Message } from './chatReducer';

export const STARTER_FIELDS: FieldKey[] = ['ubicacion', 'precio', 'area', 'inicial', 'tasa'];

const SCENARIO_REQUIRED_FIELDS: FieldKey[] = ['precio', 'inicial', 'tasa', 'plazo'];
/** The scenario prompt, in the reader's language; the API knows both. */
export const scenarioBadgeLabel = () => t().guidance.scenarioBadge;

export function getFieldQuestion(key: FieldKey, existing?: PinnedField): string {
  const g = t().guidance;
  if (!existing) return g.questions[key];
  const value = [existing.prefix, existing.value, existing.suffix].filter(Boolean).join(' ');
  return `${g.current(t().fieldLabels[key], value)} ${g.newQuestions[key]}`;
}

export function getMissingFields(fields: Record<string, PinnedField>): FieldKey[] {
  const keys = [...STARTER_FIELDS];
  if (fields.tasa || fields.inicial) keys.push('plazo');
  return keys.filter((key) => !fields[key]?.value.trim());
}

export function getAnalysisSuggestions(fields: Record<string, PinnedField>): string[] {
  if (!fields.precio?.value.trim()) return [];
  const g = t().guidance;
  const suggestions = [g.monthly];
  if (fields.inicial?.value.trim()) suggestions.push(g.moreDown);
  if (fields.ubicacion?.value.trim()) suggestions.push(g.asInvestment);
  return suggestions;
}

export function canExploreScenarios(fields: Record<string, PinnedField>): boolean {
  return SCENARIO_REQUIRED_FIELDS.every((key) => Boolean(fields[key]?.value.trim()));
}

/** Keep the assistant's questions: a bare answer needs the context it answers. */
export function toTurns(messages: Message[]): { role: 'user' | 'assistant'; content: string }[] {
  const turns: { role: 'user' | 'assistant'; content: string }[] = messages.map((message) => {
    if (message.role === 'user') return {
      role: 'user',
      content: message.respondingTo ? `${t().fieldLabels[message.respondingTo]}: ${message.content}` : message.content,
    };
    if (message.role === 'assistant-question') return { role: 'assistant', content: message.content };
    if (message.role === 'assistant-fallback') return { role: 'assistant', content: message.prose };
    if (message.role === 'assistant-note') return { role: 'assistant', content: message.content };
    return { role: 'assistant', content: [message.envelope.verdict, ...message.envelope.prose].join('\n') };
  });
  return turns.filter((turn) => turn.content.trim().length > 0);
}
