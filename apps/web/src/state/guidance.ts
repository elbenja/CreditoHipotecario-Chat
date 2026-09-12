import type { FieldKey, PinnedField } from '@chat/shared';
import type { Message } from './chatReducer';

export const STARTER_FIELDS: FieldKey[] = ['ubicacion', 'precio', 'area', 'inicial', 'tasa'];
export const SCENARIO_BADGE_LABEL = 'Qué pasa si mueves una palanca';

const SCENARIO_REQUIRED_FIELDS: FieldKey[] = ['precio', 'inicial', 'tasa', 'plazo'];
export const FIELD_LABELS: Record<FieldKey, string> = {
  ubicacion: 'Ubicación', precio: 'Precio', area: 'Área', inicial: 'Cuota inicial',
  tasa: 'Tasa', plazo: 'Plazo', alquiler: 'Alquiler',
};
const QUESTIONS: Record<FieldKey, string> = {
  ubicacion: '¿Dónde está el depa? Puedes decirme el distrito o la dirección.',
  precio: '¿Cuál es el precio del depa? Indica también la moneda.',
  area: '¿Cuántos metros cuadrados tiene el depa?',
  inicial: '¿Cuánto tienes para la cuota inicial? Puedes decirme el monto o el porcentaje.',
  tasa: '¿Qué tasa de interés te ofrece el banco? Si la conoces, indica si es TEA o TCEA.',
  plazo: '¿En cuántos años pagarías la hipoteca?',
  alquiler: '¿Por cuánto se alquila o esperas alquilar el depa al mes?',
};
const NEW_QUESTIONS: Record<FieldKey, string> = {
  ubicacion: '¿Cuál es la nueva ubicación del depa?', precio: '¿Cuál es el nuevo precio del depa?',
  area: '¿Cuál es el área correcta en metros cuadrados?', inicial: '¿Cuál es la nueva cuota inicial?',
  tasa: '¿Cuál es la nueva tasa de interés?', plazo: '¿Cuál es el nuevo plazo en años?',
  alquiler: '¿Cuál es el nuevo alquiler mensual?',
};

export function getFieldQuestion(key: FieldKey, existing?: PinnedField): string {
  if (!existing) return QUESTIONS[key];
  const value = [existing.prefix, existing.value, existing.suffix].filter(Boolean).join(' ');
  return `${FIELD_LABELS[key]} actual: ${value}. ${NEW_QUESTIONS[key]}`;
}

export function getMissingFields(fields: Record<string, PinnedField>): FieldKey[] {
  const keys = [...STARTER_FIELDS];
  if (fields.tasa || fields.inicial) keys.push('plazo');
  return keys.filter((key) => !fields[key]?.value.trim());
}

export function getAnalysisSuggestions(fields: Record<string, PinnedField>): string[] {
  if (!fields.precio?.value.trim()) return [];
  const suggestions = ['¿Cuánto pagaría al mes?'];
  if (fields.inicial?.value.trim()) suggestions.push('¿Qué cambia si aumento la inicial?');
  if (fields.ubicacion?.value.trim()) suggestions.push('¿Cómo sería este depa como inversión?');
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
      content: message.respondingTo ? `${FIELD_LABELS[message.respondingTo]}: ${message.content}` : message.content,
    };
    if (message.role === 'assistant-question') return { role: 'assistant', content: message.content };
    if (message.role === 'assistant-fallback') return { role: 'assistant', content: message.prose };
    if (message.role === 'assistant-note') return { role: 'assistant', content: message.content };
    return { role: 'assistant', content: [message.envelope.verdict, ...message.envelope.prose].join('\n') };
  });
  return turns.filter((turn) => turn.content.trim().length > 0);
}
