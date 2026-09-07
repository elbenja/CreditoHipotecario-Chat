import { callKimi } from '../src/kimi.ts';
import { runPipeline } from '../src/pipeline/index.ts';
import { buildMessages } from '../src/prompt.ts';

// Ask your own question: pass it as arguments, or omit for the default.
const turn =
  process.argv.slice(2).join(' ') ||
  'Depa de 250 mil en Pueblo Libre, 40 m², tasa 8%. ¿A cuánto lo alquilo?';

console.log(`\nTú: ${turn}\n`);

const { content: raw } = await callKimi(buildMessages([{ role: 'user', content: turn }], []));
const result = runPipeline(raw, [turn]);

if (result.ok) {
  console.log('CONTRACT HELD');
  console.log(JSON.stringify(result.envelope, null, 2));
} else {
  console.log('CONTRACT BROKEN — E4 path');
  console.log('candidates:', result.candidates);
  console.log('raw:', raw.slice(0, 2000));
}
