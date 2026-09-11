import { describe, expect, it } from 'vitest';
import { runPipeline } from './index.ts';

describe('capture replies', () => {
  it('accepts the short contract without requiring an analysis', () => {
    const result = runPipeline(JSON.stringify({
      kind: 'capture', reply: 'Listo, agregué Pueblo Libre.',
      fields: [{ key: 'ubicacion', label: 'Ubicación', value: 'Pueblo Libre', provenance: 'user' }],
    }), ['Pueblo Libre']);
    expect(result).toMatchObject({ ok: true, envelope: {
      kind: 'capture', verdict: 'Listo, recibí los datos de la propiedad.',
      fields: [{ key: 'ubicacion', provenance: 'user' }], metrics: [], scenarios: [], sources: [], prose: [], followUps: [],
    } });
  });

  it('does not fill missing data with assumptions or unsolicited metrics', () => {
    const result = runPipeline(JSON.stringify({
      kind: 'capture', reply: 'Listo.',
      fields: [
        { key: 'precio', label: 'Precio', value: '300,000', provenance: 'user' },
        { key: 'tasa', label: 'Tasa', value: '8', provenance: 'user' },
        { key: 'inicial', label: 'Inicial', value: '20', provenance: 'assumed' },
      ], metrics: [{ label: 'Cuota', value: 'S/ 2,000' }],
    }), ['Precio: 300,000']);
    expect(result).toMatchObject({ ok: true, envelope: { fields: [{ key: 'precio' }], metrics: [] } });
  });
});

it('passes a clarification key through and validates its contextual short answer', () => {
  const question = runPipeline(JSON.stringify({ kind: 'capture', reply: '¿En cuántos años?', askField: 'plazo', fields: [] }), ['¿Cuánto pagaría?']);
  expect(question).toMatchObject({ ok: true, envelope: { askField: 'plazo' } });
  const answer = runPipeline(JSON.stringify({ kind: 'capture', reply: 'Plazo registrado.', fields: [{ key: 'plazo', label: 'Plazo', value: '20', suffix: 'años', provenance: 'user' }] }), ['Plazo: 20']);
  expect(answer).toMatchObject({ ok: true, envelope: { fields: [{ key: 'plazo', value: '20', provenance: 'user' }] } });
});

it('captures a down payment and term instead of repeating the same question', () => {
  const question = '¿Cuánto tienes para cuota inicial y a qué plazo quieres financiar?';
  const result = runPipeline(JSON.stringify({
    kind: 'clarification', reply: question, fields: [],
  }), ['11% de inicial; a 22 anos'], question);

  expect(result).toMatchObject({ ok: true, envelope: {
    kind: 'capture',
    verdict: 'Listo, recibí los datos de la propiedad.',
    fields: [
      { key: 'inicial', value: '11', suffix: '%', provenance: 'user' },
      { key: 'plazo', value: '22', suffix: 'años', provenance: 'user' },
    ],
  } });
});

it('does not recover a value the user explicitly rejected', () => {
  const question = '¿Cuánto tienes para cuota inicial?';
  const result = runPipeline(JSON.stringify({
    kind: 'clarification', reply: question, fields: [],
  }), ['No tengo 11% de inicial'], question);

  expect(result).toMatchObject({ ok: true, envelope: {
    verdict: 'No pude identificar el dato en tu respuesta. ¿Puedes escribirlo otra vez con su unidad?',
    fields: [],
  } });
});

it('does not forward unsolicited advice inside a successful data confirmation', () => {
  const result = runPipeline(JSON.stringify({ kind: 'capture', reply: 'Listo. Dime el alquiler para evaluar la rentabilidad.', fields: [{ key: 'ubicacion', label: 'Ubicación', value: 'Pueblo Libre', provenance: 'user' }] }), ['Pueblo Libre']);
  expect(result).toMatchObject({ ok: true, envelope: { verdict: 'Listo, recibí los datos de la propiedad.' } });
});

it('preserves consent to estimates when a requested calculation also captures price', () => {
  const reply = '¿Quieres que use TEA 8%, inicial 20% y plazo 20 años como estimaciones?';
  const result = runPipeline(JSON.stringify({ kind: 'clarification', reply, fields: [{ key: 'precio', label: 'Precio', value: '300,000', provenance: 'user' }] }), ['¿Cuánto pagaría por un depa de 300 mil soles?']);
  expect(result).toMatchObject({ ok: true, envelope: { kind: 'capture', verdict: reply, fields: [{ key: 'precio' }], metrics: [] } });
});

it('keeps an assumed value after the user accepts the exact proposal', () => {
  const result = runPipeline(JSON.stringify({
    kind: 'capture', reply: 'Listo.',
    fields: [{ key: 'inicial', label: 'Cuota inicial', value: '20', suffix: '%', provenance: 'assumed' }],
  }), ['sí'], '¿Aceptas una cuota inicial del 20 %?');
  expect(result).toMatchObject({ ok: true, envelope: {
    fields: [{ key: 'inicial', value: '20', provenance: 'assumed' }],
  } });
});

it('still rejects an assumption that was not proposed before an affirmative answer', () => {
  const result = runPipeline(JSON.stringify({
    kind: 'capture', reply: 'Listo.',
    fields: [{ key: 'inicial', label: 'Cuota inicial', value: '20', suffix: '%', provenance: 'assumed' }],
  }), ['sí'], '¿Quieres que calcule la cuota mensual?');
  expect(result).toMatchObject({ ok: true, envelope: { fields: [] } });
});
