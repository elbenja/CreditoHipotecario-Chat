import type { FieldKey } from '@chat/shared';

/**
 * The language the person picked in the web app. Everything the API itself
 * writes (errors, progress steps, the refusal, fixed acknowledgements, labels)
 * follows it, and the model is told to answer in it.
 */
export type Lang = 'es' | 'en';
export const LANGS = ['es', 'en'] as const;

const es = {
  analyzeChat: 'Leyendo tu mensaje y los datos de la propiedad',
  analyzeListing: 'Leyendo el anuncio',
  analyzeDocument: 'Extrayendo las condiciones',
  errRequest: 'Kimi rechazó esta solicitud porque no era válida. Edita la pregunta e inténtalo de nuevo.',
  errApi: 'Se cayó la conexión con el modelo. Tus datos siguen acá.',
  errListingFetch: 'No pude abrir ese anuncio. Prueba de nuevo o pégame los datos.',
  errNotListing: 'Esa página no parece un anuncio de un departamento.',
  errListingUnreadable: 'No pude leer los datos del anuncio.',
  errDocumentOther: 'Esto no parece un cronograma ni un anuncio. Revisa que sea la primera página.',
  errDocumentUnreadable: 'No pude leer las condiciones de ese documento.',
  errLimit: 'Kimi agotó el límite antes de producir una respuesta. Prueba una pregunta más concreta.',
  errEmpty: 'Kimi no devolvió una respuesta. Intenta de nuevo.',
  schemaFallback: 'Tengo el análisis pero no pude estructurarlo esta vez. Puedes fijar los datos a mano acá abajo.',
  captureInvalid: 'No pude registrar esos datos. ¿Puedes escribirlos de nuevo?',
  captureDone: 'Listo, recibí los datos de la propiedad.',
  captureRepeated: 'No pude identificar el dato en tu respuesta. ¿Puedes escribirlo otra vez con su unidad?',
  captureUnconfirmed: 'No pude confirmar esos datos. ¿Puedes precisarlos?',
  refusalVerdict: 'De eso no sé — solo veo hipotecas y propiedades en Perú.',
  refusalFollowUps: ['Comparar tu depa contra un depósito a plazo', 'Ver si amortizar rinde más'],
  years: 'años',
  installments: 'cuotas',
  fieldLabels: {
    ubicacion: 'Ubicación',
    precio: 'Precio de compra',
    area: 'Área',
    tasa: 'Tasa TEA',
    inicial: 'Cuota inicial',
    plazo: 'Plazo',
    alquiler: 'Alquiler',
  } as Record<FieldKey, string>,
  mortgageLabels: {
    montoFinanciado: 'Monto financiado',
    cuota: 'Cuota mensual',
    tea: 'TEA',
    tcea: 'TCEA',
    plazoCuotas: 'Plazo',
    seguroDesgravamen: 'Seguro de desgravamen',
    seguroInmueble: 'Seguro del inmueble',
    valorInmueble: 'Valor del inmueble',
    totalAPagar: 'Total a pagar',
  },
  teaVariable: 'Tasa variable — el cronograma es referencial, no vinculante.',
  teaFixed: 'Tasa fija.',
  insuredValue: 'Valor asegurado o tasación, no el precio de compra.',
};

export type ApiCopy = typeof es;

const en: ApiCopy = {
  analyzeChat: 'Reading your message and the property details',
  analyzeListing: 'Reading the listing',
  analyzeDocument: 'Extracting the loan terms',
  errRequest: 'Kimi rejected this request as invalid. Edit the question and try again.',
  errApi: 'The connection to the model dropped. Your data is still here.',
  errListingFetch: "I couldn't open that listing. Try again or paste the details here.",
  errNotListing: "That page doesn't look like an apartment listing.",
  errListingUnreadable: "I couldn't read the listing's details.",
  errDocumentOther: "This doesn't look like a payment schedule or a listing. Check that it's the first page.",
  errDocumentUnreadable: "I couldn't read the terms in that document.",
  errLimit: 'Kimi hit its limit before producing an answer. Try a more specific question.',
  errEmpty: "Kimi didn't return an answer. Try again.",
  schemaFallback: "I have the analysis but couldn't structure it this time. You can pin the details by hand below.",
  captureInvalid: "I couldn't save those details. Could you write them again?",
  captureDone: 'Done, I got the property details.',
  captureRepeated: "I couldn't find the value in your answer. Could you write it again with its unit?",
  captureUnconfirmed: "I couldn't confirm those details. Could you be more specific?",
  refusalVerdict: "I can't help with that — I only cover mortgages and property in Peru.",
  refusalFollowUps: ['Compare your apartment against a term deposit', 'See whether prepaying pays off'],
  years: 'years',
  installments: 'installments',
  fieldLabels: {
    ubicacion: 'Location',
    precio: 'Purchase price',
    area: 'Area',
    tasa: 'Rate (TEA)',
    inicial: 'Down payment',
    plazo: 'Term',
    alquiler: 'Rent',
  },
  mortgageLabels: {
    montoFinanciado: 'Amount financed',
    cuota: 'Monthly payment',
    tea: 'TEA',
    tcea: 'TCEA',
    plazoCuotas: 'Term',
    seguroDesgravamen: 'Credit life insurance',
    seguroInmueble: 'Property insurance',
    valorInmueble: 'Property value',
    totalAPagar: 'Total to pay',
  },
  teaVariable: 'Variable rate — the schedule is indicative, not binding.',
  teaFixed: 'Fixed rate.',
  insuredValue: 'Insured or appraised value, not the purchase price.',
};

export const COPY: Record<Lang, ApiCopy> = { es, en };

/**
 * Appended to the (Spanish) system prompt when the person reads English. The
 * contract's keys and enum values stay as they are; only what a person reads
 * changes language. Currency stays in soles: the market is still Peru.
 */
export const ENGLISH_ANSWER_RULE = `LANGUAGE OVERRIDE
- The person is reading in English. Write every human-readable string in English: "reply", "verdict", field "label", "note" and "suffix" (e.g. "years"), metric "label" and "context", scenario "cause", "unit" and "note", "prose", "followUps" (still in the user's first person) and the out-of-scope line ("I can't help with that — I only cover mortgages and property in Peru.").
- "What if I pull a lever" is the English for "Qué pasa si mueves una palanca": answer it with 2 to 3 scenarios under the same rule.
- Keep every JSON key and enum value exactly as the schema says ("ubicacion", "precio", "user", "assumed", "tradeoff"…).
- Amounts stay in soles in the house format: "S/ 1,750". Peruvian terms such as TEA, TCEA, Mivivienda and Techo Propio keep their names.`;
