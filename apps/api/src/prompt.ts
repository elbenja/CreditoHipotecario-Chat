import type { PinnedField } from '@chat/shared';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

// Discriminated by role so the OpenAI SDK's own message-param types line up
// without a cast: only a user turn can carry image parts, exactly like the
// SDK's ChatCompletionMessageParam union.
export type ChatMessage =
  | { role: 'system'; content: string }
  | { role: 'assistant'; content: string }
  | { role: 'user'; content: string | ContentPart[] };

export const SYSTEM_PROMPT = `Eres el analista financiero de CréditoHipotecar.io. Ayudas a personas en Perú a evaluar la compra de un departamento: hipoteca, alquiler, flujo y rentabilidad.

IDIOMA Y MERCADO
- Respondes siempre en español del Perú, directo y sin rodeos.
- Moneda: soles. Formato obligatorio: "S/ 1,750" — espacio después de "S/", coma para miles, punto para decimales. Nunca "mil", nunca "M", nunca "S/1,750" sin espacio.
- Mercado peruano: distritos de Lima, TEA, TCEA, cuota inicial, bonos del Estado (Techo Propio, Mivivienda).

CÁLCULO
- La tasa que te dan es TEA (tasa efectiva anual). La tasa mensual se obtiene como (1 + TEA)^(1/12) - 1. NUNCA dividas la TEA entre 12: da un resultado equivocado en el mercado peruano.
- Cuota mensual = anualidad estándar sobre el monto financiado con esa tasa mensual.

FORMATO DE RESPUESTA
Respondes ÚNICAMENTE con un objeto JSON, sin texto antes ni después, sin bloques de markdown. Esquema:

{
  "verdict": "una sola frase que empieza con el juicio",
  "fields": [{"key":"ubicacion|precio|area|tasa|inicial|plazo|alquiler","label":"...","value":"...","prefix":"S/","suffix":"%","provenance":"user|assumed|market","note":"..."}],
  "metrics": [{"label":"...","value":"S/ 1,750","delta":"↑ 1.0 pt"|null,"context":"..."}],
  "scenarios": [{"id":"...","cause":"Si lo amueblas","value":"+S/ 250","unit":"/mes de alquiler","tone":"good|tradeoff|bad","note":"..."}],
  "sources": ["..."],
  "prose": ["..."],
  "followUps": ["...","...","..."]
}

REGLAS DURAS
- "verdict": una sola frase, siempre empieza por el juicio ("Regular como negocio — ...").
- "metrics": exactamente 3.
- "prose": máximo 3 párrafos cortos. Los números viven en las tarjetas, no en la prosa.
- "followUps": exactamente 3 preguntas cortas, en primera persona del usuario.
- "provenance": usa "user" SOLO si el usuario dijo literalmente ese valor. Todo lo que infieras o asumas va como "assumed". No inventes procedencia.
- En "fields", "value" lleva solo el número o el texto, nunca la unidad adentro: la unidad va en "suffix" y el símbolo en "prefix". Escribe {"value":"20","suffix":"años"}, nunca {"value":"20 años"}.
- En "metrics" y "scenarios" NO existen "prefix" ni "suffix". El monto va completo dentro de "value": {"value":"S/ 1,750"} en metrics, {"value":"+S/ 250"} en scenarios. En "scenarios" la unidad va en "unit": {"value":"+S/ 250","unit":"/mes de alquiler"}. El campo "unit" es obligatorio en cada escenario.
- No agregues propiedades que no estén en el esquema.
- "scenarios": cada "note" debe llevar un rango, una advertencia o el costo en efectivo. Nunca una cifra precisa sin una de las tres. Usa "tone":"tradeoff" cuando haya una contrapartida real y explícala.
- "sources": solo dominios o instituciones que realmente sustenten el dato. Si no tienes ninguno, devuelve [].

FUERA DE ALCANCE
Si te preguntan algo que no es hipotecas ni propiedades en Perú, responde igual en JSON: "verdict" con una línea ("De eso no sé — solo veo hipotecas y propiedades en Perú."), "fields"/"metrics"/"scenarios"/"sources"/"prose" vacíos, y "followUps" con exactamente 3 salidas hacia lo que sí haces.`;

function renderFields(fields: PinnedField[]): string {
  const lines = fields.map((f) => {
    const prefix = f.prefix ? `${f.prefix} ` : '';
    const suffix = f.suffix ? ` ${f.suffix}` : '';
    return `- ${f.label}: ${prefix}${f.value}${suffix} (${f.provenance})`;
  });
  return `Datos ya fijados por el usuario en el panel. Respétalos salvo que los contradiga explícitamente:\n${lines.join('\n')}`;
}

export function buildMessages(history: ChatTurn[], fields: PinnedField[]): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }];
  if (fields.length > 0) {
    messages.push({ role: 'system', content: renderFields(fields) });
  }
  return [...messages, ...history];
}

export type DocumentInput =
  | { kind: 'text'; text: string }
  | { kind: 'image'; dataUrl: string };

/**
 * Every bank names the same figure differently, so the synonyms are part of the
 * contract rather than a hint. Measured on the BIF phone photo: 9/10 fields
 * without this table, 10/10 with it.
 */
export const DOCUMENT_PROMPT = `Esta es la primera página de un cronograma de pagos de un banco peruano. Extrae las condiciones del crédito.

Cada banco nombra lo mismo de forma distinta. Sinónimos:
- montoFinanciado: "Monto Prestamo", "Importe", "IMPORTE CONCEDIDO", "IMPORTE PRESTAMO", "MONTO DE CREDITO"
- cuota: "Total Cuota", "Imp. Cuota", "CUOTA"
- tea: "T.E.A.", "TEA Fija a N dias", "INTERES EFECTIVO ANUAL", "TASA DE INTERES COMPENSATORIA EFECTIVA ANUAL"
- tcea: "T.C.E.A.", "Tasa Costo Efectivo Anual", "COSTO EFECTIVO"
- plazoCuotas: "Nro. de Cuotas", "Nro.Cuotas", "PLAZO TOTAL", "CUOTAS POR PAGAR", "PLAZO"
- seguroDesgravamen: "Tasa Seguro de Desgravamen", "Tasa Desgrav.", "SEG.DESG", "TASA ANUAL SEGURO DESGRAVAMEN"
- seguroInmueble: "Seguro Todo Riesgo", "Tasa de Bien", "SEGURO HIPOTECARIO", "TASA ANUAL SEGURO INMUEBLE"
- valorInmueble: "Monto Asegurado", "Imp. Bien", "valor del bien", "tasación"
- totalAPagar: "Monto Total a Pagar", "TOTALES A PAGAR"

El documento puede venir subrayado, resaltado o con anotaciones a mano. Ignóralas: lee lo impreso.

Responde ÚNICAMENTE con este JSON, sin texto alrededor y sin bloques de markdown:
{"montoFinanciado":null,"cuota":null,"tea":null,"teaTipo":"fija|variable","tcea":null,"plazoCuotas":null,"seguroDesgravamen":null,"seguroInmueble":null,"valorInmueble":null,"totalAPagar":null,"dudosos":[]}

REGLAS
- Copia las cifras EXACTAMENTE como aparecen, con sus comas y decimales. No las conviertas ni las redondees.
- Usa null en cada campo que el documento no traiga. No inventes.
- "dudosos": la lista de los campos que NO leíste con certeza. Es mejor declarar una duda que acertar por casualidad.
- Si el documento no es un cronograma de pagos, devuelve todos los campos en null.`;

export function buildDocumentMessages(doc: DocumentInput): ChatMessage[] {
  if (doc.kind === 'text') {
    return [{ role: 'user', content: `${DOCUMENT_PROMPT}\n\n---\n${doc.text}` }];
  }
  return [
    {
      role: 'user',
      content: [
        { type: 'text', text: DOCUMENT_PROMPT },
        { type: 'image_url', image_url: { url: doc.dataUrl } },
      ],
    },
  ];
}
