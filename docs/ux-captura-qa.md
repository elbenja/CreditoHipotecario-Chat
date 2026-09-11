# Handoff — captura progresiva, respuestas breves y escenarios

Actualizado el 11 de septiembre de 2026. Este documento registra las decisiones
de producto y la arquitectura del pase de UX realizado en
`codex/ux-captura-propiedad`, después rebasado sobre el `main` que ya contenía
el pase de UX del cronograma.

## Decisiones de producto

- El inicio enseña cómo describir una propiedad y su hipoteca con un ejemplo.
  Debajo ofrece cinco acciones: Ubicación, Precio, Área, Cuota inicial y Tasa.
- Cada acción hace una pregunta local en el chat. No llama al modelo hasta que
  el usuario responde. La misma ruta se reutiliza para modificar un dato ya
  fijado, mostrando su valor actual y preguntando por el nuevo.
- Una acción desaparece cuando su dato ya está definido. El plazo se ofrece
  después de que exista cuota inicial o tasa.
- El alquiler no se pregunta al usuario. Cuando sea necesario para una consulta,
  Kimi propone un rango de mercado usando ubicación y área, lo identifica como
  estimado y lo devuelve con `provenance: market`.
- Aportar datos no dispara análisis, cálculos, recomendaciones ni tarjetas. La
  respuesta confirma brevemente lo registrado. El análisis se ejecuta solo
  cuando el usuario lo solicita.
- Las acciones bajo «Ahora puedes preguntar» aparecen según los datos fijados.
  Incluyen cuota mensual, cambio de inicial y evaluación como inversión.
- «Qué pasa si mueves una palanca» ocupa la primera posición cuando ya existen
  precio, cuota inicial, TEA y plazo. Usa `bookmark-add-02` y el amarillo de
  marca `text-ch-accent`. Al pulsarlo pide de dos a tres escenarios y renderiza
  los `ScenarioCard` que ya existían; no se creó otra clase de tarjeta.

## Arquitectura de captura

- `guidance.ts` concentra preguntas, etiquetas, datos faltantes y sugerencias.
  `pendingField` y `respondingTo` conservan el contexto de respuestas breves
  como «8%» o «20» sin alterar el texto visible al usuario.
- Hay dos contratos de respuesta cortos: `capture` registra datos y
  `clarification` pregunta por un dato necesario. El contrato `analysis` queda
  reservado para solicitudes explícitas de análisis.
- Kimi debe preguntar por un solo dato a la vez. Si el usuario contesta varios,
  debe extraerlos todos. El pipeline evita repetir literalmente una aclaración;
  si la respuesta es clara, registra los datos, y si sigue siendo ambigua pide
  escribir el dato otra vez con su unidad.
- El pipeline rescata de forma determinista cuota inicial y plazo cuando están
  escritos explícitamente, incluso si el modelo omite su extracción. La
  validación de procedencia se vuelve a aplicar al rescate para no registrar
  frases negadas como «no tengo 11% de inicial».
- Los precios con separadores peruanos se consideran equivalentes: `866 000`,
  `866,000`, `866.000`, `866000` y `866 mil` pueden validar el mismo monto. El
  valor guardado se presenta agrupado.
- Un dato manual del panel sigue siendo propiedad del usuario. Una cifra distinta
  propuesta por el modelo se muestra como propuesta y no lo sobreescribe.
- La integración conserva el flujo completo del cronograma: adjuntar o soltar
  PDF, progreso, confirmación, grupos Propiedad/Hipoteca y paneles móvil/escritorio.
  La pantalla inicial combina esas funciones con la nueva captura guiada.

## Consumo y manejo de errores

- Los mensajes vacíos se eliminan del historial tanto en web como en API.
- El chat usa `kimi-k2.6`, pensamiento desactivado y un máximo de 1,200 tokens
  de salida. La lectura de cronogramas conserva su modelo y límite independiente
  de 4,000 tokens.
- Las respuestas de análisis se limitan a lo solicitado: hasta dos métricas, un
  párrafo corto y dos follow-ups. Aumentar el límite no se usa como solución a
  respuestas largas.
- «Continuar» solo aparece si hubo contenido válido y la respuesta terminó por
  límite. Una respuesta vacía produce un error, no una continuación falsa.
- Un rechazo HTTP 400 se presenta como solicitud inválida y permite editar la
  pregunta. Una caída de conexión se presenta por separado y permite reintentar.
  Los datos ya fijados permanecen en ambos casos.

## Verificación y límites conocidos

- Después de rebasar sobre el `main` vigente: 433 pruebas pasan (shared 53,
  API 166, web 214), typecheck limpio, build de web correcto y
  `git diff --check` limpio.
- Se verificó en navegador el flujo de captura y el badge de escenarios con
  datos ficticios. La acción produjo tres tarjetas existentes con «Guardar».
- Una reproducción posterior con el ejemplo `866 000 soles` no se envió al
  proveedor externo porque la revisión automática bloqueó ese egreso. Los casos
  exactos de precio espaciado, respuesta múltiple, repetición y negación están
  cubiertos por pruebas deterministas locales.
- No se midió el ahorro real de tokens ni se certificó la exactitud financiera
  de Kimi. Los números siguen siendo indicativos y el producto continúa como POC.

## Commits del pase de UX

- `9d270d5` — captura guiada antes del análisis solicitado.
- `485c244` — historial compacto, límites de respuesta y errores diferenciados.
- `d7ac4d8` — deja de ofrecer preguntas para datos ya capturados y estima alquiler.
- `54e5028` — badge que abre los escenarios existentes.
- `b694a23` — evita preguntas repetidas y reconoce formatos numéricos adicionales.
