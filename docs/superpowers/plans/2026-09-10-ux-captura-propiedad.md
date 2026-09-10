# Captura progresiva — Implementation Plan

**Goal:** Recoger datos con ayuda opcional y analizar únicamente cuando el usuario lo pida.
**Architecture:** Preguntas locales compartidas por campo; mensajes de pregunta conservados en el reducer; contrato JSON corto de captura normalizado al envelope existente; sugerencias locales según los campos disponibles.
**Tech Stack:** React, TypeScript, Fastify, Zod, Vitest y Tailwind existentes.

## 1. Contrato y respuesta
- [x] Añadir pruebas de captura: reply y fields se convierten a una respuesta breve; datos asumidos y métricas no se muestran en captura.
- [x] Añadir CaptureEnvelopeSchema y kind opcional al envelope existente, conservando borradores y clientes antiguos.
- [x] Ajustar prompt: captura por defecto al aportar datos; análisis explícito y limitado a la pregunta; preguntar antes de estimar faltantes.
- [x] Sustituir pasos de cálculo anticipados por un estado neutral de lectura.

## 2. Preguntas y contexto
- [x] Probar que tocar un campo crea una pregunta sin fetch y que una respuesta breve conserva su campo en el historial enviado.
- [x] Crear definiciones de preguntas por FieldKey y opciones contextuales.
- [x] Extender reducer con askField y pendingField; persistencia compatible por initialState.
- [x] Conservar preguntas y respuestas breves del asistente en el historial; contextualizar respuestas guiadas sin cambiar lo que se ve en el chat.

## 3. Interfaz
- [x] Cambiar EmptyState a ejemplo de propiedad/hipoteca y cinco badges.
- [x] Renderizar preguntas y confirmaciones sin estilo de análisis.
- [x] Ofrecer campos faltantes y preguntas prácticas según los datos, sin duplicar recomendaciones en respuestas de captura.
- [x] Mantener edición directa y controles existentes. Mostrar título de propiedad según ubicación conocida.

## 4. Verificación
- [x] Ejecutar pnpm test, pnpm typecheck y pnpm --filter @chat/web build.
- [x] Revisar en navegador vacío, pregunta, captura y análisis solicitado a 390px y escritorio con API simulada.
- [x] Revisar diff, conservar cambios del checkout original y dejar commit listo para revisión.
