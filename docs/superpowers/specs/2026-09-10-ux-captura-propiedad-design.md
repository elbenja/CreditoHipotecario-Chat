# Captura conversacional de una propiedad

Diseño aprobado por el usuario el 10 de septiembre de 2026.

La entrada explica cómo describir una propiedad con su hipoteca y ofrece Ubicación, Precio, Área, Cuota inicial y Tasa. Cada botón agrega una pregunta local al chat, sin solicitud al modelo. El usuario puede responder libremente, aportar varios datos o pedir un análisis desde el principio. La misma definición de preguntas admite corregir un dato existente.

Aportar datos produce una confirmación breve definida por la aplicación y actualiza el panel; no genera métricas, escenarios ni supuestos para llenar huecos. El modelo usa un contrato corto de captura, separado del contrato de análisis. Las preguntas locales y el contexto de la respuesta deben viajar en el historial para interpretar respuestas como «8%» sin inventar procedencia.

Las opciones de análisis aparecen por contexto: precio permite preguntar por la cuota; precio e inicial permiten explorar una inicial mayor; ubicación y precio permiten evaluar la inversión. No son un certificado de datos completos: ante faltantes, el asistente pregunta o propone usar estimaciones. El plazo se ofrece cuando ya se aportó algún dato de hipoteca. Se mantiene la edición directa del panel.

Las respuestas de análisis se limitan a lo solicitado. Se conservan borradores existentes, protección de ediciones manuales, errores y cronogramas. No se integra ni se publica la rama en esta ejecución; queda disponible para revisar y hacer merge después.

Verificación: pruebas de la captura sin análisis, preguntas sin red, continuidad tras recarga, contexto de respuestas breves, opciones contextuales, regresiones del chat, typecheck, build y revisión visual móvil/escritorio. El ahorro de tokens y la calidad con Kimi real no se afirman sin medición.

Las preguntas de aclaración generadas por el modelo incluyen askField. La captura conserva la base del último análisis para marcar cifras desactualizadas; reintentar conserva la solicitud de recálculo.

El contrato corto distingue capture (confirmación de la aplicación) de clarification (pregunta del modelo, incluido consentimiento para estimaciones). Ambos se muestran sin tarjetas de análisis.
