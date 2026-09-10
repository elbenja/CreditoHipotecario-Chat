# Captura de propiedad — verificación

Fecha: 2026-09-10. Rama: codex/ux-captura-propiedad. Base: a910dbc (fase-b-cronograma).

## Comportamiento

- Inicio con ejemplo de propiedad/hipoteca y cinco botones de datos.
- Tocar Ubicación abre una pregunta local. La prueba de integración verifica cero llamadas de red y conservación del campo pendiente tras recarga.
- Captura de varios datos en un solo mensaje; confirmación breve sin tarjetas de análisis ni campos asumidos.
- Opciones contextuales de cuota, inicial e inversión. El plazo se ofrece después de aportar datos de hipoteca.
- Preguntas por datos faltantes del modelo conservan askField, para validar respuestas como «20» con contexto de plazo.
- Edición mantiene datos manuales protegidos y el aviso de que un análisis anterior está desactualizado. Reintentar un recálculo conserva su solicitud exacta, incluso después de mensajes de captura.

## Pruebas y revisión

305 pruebas pasan: shared 53, API 145, web 107. Typecheck y build de web correctos; git diff --check limpio. Avisos de pdf.js y errores simulados de API ya presentes en la base no representan fallos de pruebas.

Revisión de código independiente: cuatro casos detectados y corregidos (baseline tras captura, reintento de recálculo, contexto de preguntas del modelo y análisis sin métricas).

Verificación en Codex Browser a 390 × 844 y 1280 × 800: inicio, pregunta local, captura de varios datos, opciones contextuales, análisis solicitado, panel móvil expandido y edición con aviso de recálculo. API simulada al principio y API real con Kimi después; no se usaron datos personales ni documentos.

## Modelo real

Con ejemplos ficticios, Kimi registró cinco campos sin métricas, escenarios ni supuestos. Ante una pregunta de cuota incompleta, pidió la cuota inicial y devolvió askField=inicial. Al solicitar cuota con los datos completos produjo un análisis; antes de pedirla solo se registraron los datos.

Se observó una invitación extra a analizar dentro de una confirmación. La confirmación ahora la define la API cuando solo se registran datos, con una prueba que evita reenviar esa recomendación. Las aclaraciones y solicitudes de consentimiento usan un discriminador separado para conservar sus preguntas, incluso si a la vez se registra el precio. Se afinó también el prompt para pedir una sola métrica cuando se solicita únicamente la cuota.

No se midió el ahorro de tokens ni se validó la exactitud del cálculo financiero. El análisis sigue dependiendo del modelo. No hay despliegue ni merge; el checkout original y sus cambios pendientes del lector PDF se conservan.
