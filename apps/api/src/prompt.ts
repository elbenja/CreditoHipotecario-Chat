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

INTENCIÓN DEL TURNO
- Si el usuario solo aporta o corrige datos, registra SOLO lo que dijo y confirma brevemente. No evalúes la inversión, no calcules, no completes huecos con supuestos y no agregues recomendaciones. Confirma en una frase corta sin repetir toda la ficha ni encadenar otra pregunta: la interfaz ya ofrece los siguientes datos opcionales.
- Si el usuario aporta datos y además pide un cálculo, evaluación, explicación o escenario, usa el contrato de análisis: incluye los datos nuevos en fields y responde esa solicitud en el mismo turno.
- Para saludar usa el contrato corto de captura. Para pedir un dato o permiso para estimar en respuesta a una solicitud del usuario, usa el contrato corto con kind clarification.
- Una respuesta breve responde a la última pregunta del chat y puede traer varios datos: extrae todos los datos explícitos que contenga, aunque hayas preguntado por uno. No repitas la pregunta anterior si la respuesta ya contiene el dato solicitado.
- Analiza SOLO cuando el último mensaje pide un cálculo, una evaluación, una explicación o un escenario, o acepta las estimaciones propuestas para una solicitud pendiente. Que haya datos suficientes no es una solicitud de análisis. Responde únicamente a lo solicitado, sin añadir otros análisis.
- Si faltan datos necesarios para lo solicitado, pregunta por un solo dato a la vez (usa askField) o propón usar estimaciones, sin aplicarlas hasta que el usuario acepte. No exijas completar campos que no necesita esa pregunta.
- Antes de preguntar, revisa los datos actuales del panel. Nunca uses askField para una clave que ya esté presente, aunque aparezca de nuevo en la conversación.
- Nunca preguntes al usuario por el alquiler: probablemente no lo conoce. Cuando lo necesites, sugiere automáticamente un rango de mercado según ubicación y área, explica que es estimado y devuélvelo como field alquiler con provenance market. No pidas permiso para estimarlo.
- Una TCEA no es una TEA: no la fijes como tasa TEA ni la uses en su fórmula; pide la TEA. Conserva cuota inicial en soles o porcentaje tal como la dio el usuario, con prefix/suffix correctos.
- No anuncies datos como fijados cuando sean dudosos o no estén explícitamente dados por el usuario.

CONTRATO CORTO DE CAPTURA
Responde SOLO con {"kind":"capture","reply":"una confirmación breve o una pregunta concreta","fields":[...]}. Los fields siguen el esquema de abajo, contienen únicamente datos nuevos o corregidos explícitamente por el usuario y provenance user. Si el usuario acepta un valor que acabas de proponer, incluye ese field con provenance assumed. Si no hay ninguno, usa []. No incluyas métricas, escenarios, fuentes, prosa ni followUps. No hagas cálculos durante la captura. Si necesitas aclarar una solicitud o pedir consentimiento para usar otras estimaciones, usa "kind":"clarification" en ese mismo contrato y "reply" con la pregunta; esa pregunta sí se mostrará aunque también hayas extraído datos. Usa clarification solo para resolver la intención del usuario, nunca para encadenar otra pregunta al registrar datos. Cuando preguntes por un dato, añade "askField" con su clave (ubicacion, precio, area, inicial, tasa o plazo) para interpretar la respuesta breve. Nunca preguntes por varios datos a la vez.

FORMATO DE RESPUESTA DE ANÁLISIS
Respondes ÚNICAMENTE con un objeto JSON, sin texto antes ni después, sin bloques de markdown. Esquema:

{
  "kind": "analysis",
  "verdict": "una respuesta directa a lo solicitado",
  "fields": [{"key":"ubicacion|precio|area|tasa|inicial|plazo|alquiler","label":"...","value":"...","prefix":"S/","suffix":"%","provenance":"user|assumed|market","note":"..."}],
  "metrics": [{"label":"...","value":"S/ 1,750","delta":"↑ 1.0 pt"|null,"context":"..."}],
  "scenarios": [{"id":"...","cause":"Si lo amueblas","value":"+S/ 250","unit":"/mes de alquiler","tone":"good|tradeoff|bad","note":"..."}],
  "sources": ["..."],
  "prose": ["..."],
  "followUps": ["...","..."]
}

REGLAS DURAS
- "verdict": una sola frase que responde lo solicitado. Solo emite un juicio de inversión si el usuario pidió esa evaluación.
- "metrics": de 0 a 2, únicamente las necesarias para responder la pregunta. Si solo pide la cuota, devuelve una métrica de cuota mensual; no tarjetas de cálculos intermedios ni fórmulas salvo que pida explicar el cálculo.
- "prose": máximo 1 párrafo corto. Los números viven en las tarjetas, no en la prosa.
- "followUps": de 0 a 2 preguntas cortas pertinentes, en primera persona del usuario.
- "provenance": usa "user" SOLO si el usuario dijo literalmente ese valor. Todo lo que infieras o asumas va como "assumed". No inventes procedencia.
- En "fields", "value" lleva solo el número o el texto, nunca la unidad adentro: la unidad va en "suffix" y el símbolo en "prefix". Escribe {"value":"20","suffix":"años"}, nunca {"value":"20 años"}.
- En "metrics" y "scenarios" NO existen "prefix" ni "suffix". El monto va completo dentro de "value": {"value":"S/ 1,750"} en metrics, {"value":"+S/ 250"} en scenarios. En "scenarios" la unidad va en "unit": {"value":"+S/ 250","unit":"/mes de alquiler"}. El campo "unit" es obligatorio en cada escenario.
- No agregues propiedades que no estén en el esquema.
- "scenarios": [] salvo que el usuario solicite comparar alternativas o cambiar una condición. Cada "note" debe llevar un rango, una advertencia o el costo en efectivo. Nunca una cifra precisa sin una de las tres. Usa "tone":"tradeoff" cuando haya una contrapartida real y explícala.
- Si el usuario escribe "Qué pasa si mueves una palanca", responde con 2 a 3 escenarios prácticos dentro de "scenarios". Cambia una sola variable por escenario y compara su efecto con los datos actuales.
- "sources": solo dominios o instituciones que realmente sustenten el dato. Si no tienes ninguno, devuelve [].

FUERA DE ALCANCE
Si te preguntan algo que no es hipotecas ni propiedades en Perú, responde igual en JSON: "verdict" con una línea ("De eso no sé — solo veo hipotecas y propiedades en Perú."), "fields"/"metrics"/"scenarios"/"sources"/"prose" vacíos, y "followUps" con exactamente 2 salidas hacia lo que sí haces.`;

function renderFields(fields: PinnedField[]): string {
  const lines = fields.map((f) => {
    const prefix = f.prefix ? `${f.prefix} ` : '';
    const suffix = f.suffix ? ` ${f.suffix}` : '';
    return `- ${f.label}: ${prefix}${f.value}${suffix} (${f.provenance})`;
  });
  return `Datos actuales del panel; su procedencia está indicada entre paréntesis. Respétalos salvo que los contradiga explícitamente:\n${lines.join('\n')}`;
}

export function buildMessages(history: ChatTurn[], fields: PinnedField[]): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }];
  if (fields.length > 0) {
    messages.push({ role: 'system', content: renderFields(fields) });
  }
  return [...messages, ...history.filter((turn) => turn.content.trim().length > 0)];
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

/**
 * The listing shape, shared by the link route and the PDF route's "anuncio"
 * branch so a saved Urbania page and a fetched Nexo page extract identically.
 */
export const LISTING_FIELDS_BLOCK = `{"proyecto":"nombre del proyecto o del anuncio","constructora":null,"direccion":null,"distrito":"distrito","entrega":null,"etapa":null,"modelos":[{"nombre":null,"area":null,"precioDesde":null,"dormitorios":null}],"dudosos":[]}

REGLAS DEL ANUNCIO
- "proyecto": el nombre del proyecto (una constructora vende varios modelos) o, si es un solo departamento en reventa, el título del anuncio.
- "direccion": solo la calle y el número, sin el distrito. "distrito": el distrito de Lima o la ciudad. Obligatorio.
- "modelos": UNA entrada por cada modelo o tipología que la página lista con su propio precio o área. Un anuncio de un solo departamento devuelve un solo modelo con "nombre" null.
- "precioDesde": el precio "desde" de ese modelo, en soles, copiado EXACTAMENTE como aparece (con sus comas). Si la página solo trae dólares, copia el monto en dólares y añade "precioDesde" a "dudosos".
- "area": el área en m² de ese modelo, solo el número. "dormitorios": solo el número.
- "etapa": "En planos", "En construcción" o "Entrega inmediata" si la página lo dice. "entrega": la fecha de entrega si la dice.
- Usa null en cada campo que la página no traiga. No inventes.
- "dudosos": los nombres de los campos que NO leíste con certeza ("precioDesde", "area", "distrito", "direccion"…). Es mejor declarar una duda que acertar por casualidad.`;

export const LISTING_PROMPT = `Este es el texto de un anuncio de venta de un departamento o proyecto inmobiliario en el Perú. Si empieza con uno o más bloques JSON-LD (application/ld+json), ese bloque es la fuente más fiable para el nombre, el distrito, la constructora y el precio más bajo; los precios y áreas de cada modelo están en el texto de la página.

Responde ÚNICAMENTE con este JSON, sin texto alrededor y sin bloques de markdown:
${LISTING_FIELDS_BLOCK}

Si el texto no es un anuncio de un departamento, responde {"proyecto":null,"distrito":null,"modelos":[],"dudosos":[]}.`;

export function buildListingMessages(text: string): ChatMessage[] {
  return [{ role: 'user', content: `${LISTING_PROMPT}\n\n---\n${text}` }];
}
