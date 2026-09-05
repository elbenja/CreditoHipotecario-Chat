import type { AnalysisEnvelope } from '@chat/shared';

/**
 * Vocabulary that marks a message as belonging to this product. Deliberately
 * broad: a false negative here only means the model handles the message, which
 * is the safe direction.
 */
const IN_SCOPE = [
  'depa', 'departamento', 'casa', 'inmueble', 'propiedad', 'terreno', 'local',
  'hipoteca', 'hipotecari', 'credito', 'crédito', 'prestamo', 'préstamo', 'banco',
  'cuota', 'inicial', 'tea', 'tcea', 'tasa', 'plazo', 'amortiz', 'dividendo',
  'alquil', 'arriendo', 'renta', 'inquilino', 'vacancia',
  'yield', 'rentabilidad', 'flujo', 'plusval', 'metro cuadrado', 'm2', 'm²',
  'comprar', 'compra', 'vender', 'venta', 'invertir en un', 'inversion inmobil',
  'distrito', 'lima', 'miraflores', 'surco', 'pueblo libre', 'jesus maria', 'magdalena',
  'mivivienda', 'techo propio', 'bono', 'deposito a plazo', 'depósito a plazo',
];

/** High-precision markers for topics this product does not cover. */
const OUT_OF_SCOPE = [
  'bitcoin', 'cripto', 'crypto', 'ethereum', 'blockchain', 'nft',
  'acciones de la bolsa', 'bolsa de valores', 'forex', 'trading', 'etf',
  'python', 'javascript', 'escribe.{0,12}c[oó]digo', 'funci[oó]n en ',
  'receta', 'chiste', 'poema', 'letra de la canci[oó]n',
  'me duele', 'pastilla', 'medicamento', 's[ií]ntoma', 'diagn[oó]stico',
  'elecciones', 'presidente del per', 'partido pol[ií]tico',
  'ignora .{0,25}instruc', 'olvida .{0,25}instruc', 'system prompt', 'act[uú]a como',
];

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * True only when the message trips an out-of-scope marker AND carries no
 * in-scope vocabulary at all. Mixed messages go to the model, which reframes
 * them — that is the E5 behaviour the design specifies.
 */
export function isOutOfScope(text: string): boolean {
  const t = normalize(text);

  const tripped = OUT_OF_SCOPE.some((p) => new RegExp(p).test(t));
  if (!tripped) return false;

  const inScope = IN_SCOPE.some((k) => t.includes(normalize(k)));
  return !inScope;
}

/** E5, shaped as a valid envelope so the transcript renders it like any answer. */
export const REFUSAL_ENVELOPE: AnalysisEnvelope = {
  verdict: 'De eso no sé — solo veo hipotecas y propiedades en Perú.',
  fields: [],
  metrics: [],
  scenarios: [],
  sources: [],
  prose: [],
  followUps: [
    'Comparar tu depa contra un depósito a plazo',
    'Ver si amortizar rinde más',
    '¿Cuánto me presta el banco?',
  ],
};
